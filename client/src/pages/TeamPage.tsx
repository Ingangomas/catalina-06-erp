import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { USER_ROLE_LABELS } from "@shared/expenseConstants";
import { ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { toast } from "sonner";

export default function TeamPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const canManage = user?.role === "admin";
  const users = trpc.projectUsers.list.useQuery(undefined, { enabled: user?.role === "contador" || user?.role === "admin" });
  const assignRole = trpc.projectUsers.assignRole.useMutation({ onSuccess: () => utils.projectUsers.list.invalidate() });
  const applyRole = async (userId: number, role: "socio_1" | "socio_2" | "participante" | "contador" | "admin" | "user") => { try { await assignRole.mutateAsync({ userId, role }); toast.success("Rol actualizado."); } catch (error) { toast.error(error instanceof Error ? error.message : "No fue posible actualizar el rol."); } };

  if (user?.role !== "contador" && user?.role !== "admin") return <div className="glass-surface mx-auto max-w-2xl rounded-2xl border-[#ffe7b3] bg-[#fffaf0]/75 p-5 text-sm text-[#7d5d22]">Esta vista está disponible para Contador y Administrador.</div>;

  return <div className="mx-auto max-w-5xl space-y-6">
    <section>
      <p className="page-eyebrow">Gobernanza del proyecto</p>
      <h1 className="page-title mt-1">Equipo y roles</h1>
      <p className="page-lede mt-2 max-w-3xl">El Contador puede consultar los usuarios. El Administrador asigna roles, incluyendo participantes adicionales para cargar gastos. Las cuentas autorizadas se preparan antes de su primer acceso y consolidan su sesión al iniciar sesión.</p>
    </section>
    <Card className="surface-card overflow-hidden">
      <CardHeader className="flex-row items-center gap-3 border-b border-[#e5eaf6] pb-4">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eef2ff] text-[#637de1]"><UsersRound className="h-5 w-5" /></span>
        <div><p className="page-eyebrow">Accesos</p><CardTitle className="mt-0.5 text-lg text-[#1c2942]">Usuarios con acceso</CardTitle></div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#f7f9fe] text-xs font-bold uppercase tracking-wide text-[#71809a]"><tr><th className="px-5 py-3">Nombre operativo</th><th className="px-5 py-3">Correo</th><th className="px-5 py-3">Acceso del proyecto</th><th className="px-5 py-3">Titular de gastos</th><th className="px-5 py-3">Último acceso</th><th className="px-5 py-3">Administración</th></tr></thead>
            <tbody className="divide-y divide-[#e8edf7]">
              {users.data?.map(member => <tr key={member.id} className="transition-colors hover:bg-white/65"><td className="px-5 py-4 font-medium text-[#1c2942]"><p>{member.displayName || member.name || "Sin nombre"}</p>{member.displayName && member.name && member.displayName !== member.name ? <p className="mt-0.5 text-xs font-normal text-[#71809a]">Cuenta: {member.name}</p> : null}</td><td className="px-5 py-4 text-[#65718a]">{member.email || "—"}</td><td className="px-5 py-4"><span className="inline-flex rounded-full border border-white/75 bg-white/65 px-2.5 py-1 text-xs font-semibold text-[#53617a] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">{USER_ROLE_LABELS[member.role]}</span></td><td className="px-5 py-4 text-[#65718a]">{member.expenseOwnerType === "socio_1" ? "Gastos Ing. Raymond" : member.expenseOwnerType === "socio_2" ? "Gastos Ing. Johan" : member.expenseOwnerType === "participante" ? "Gastos de participante" : "—"}</td><td className="px-5 py-4 text-[#65718a]">{member.loginMethod === "preassigned" ? <span className="inline-flex rounded-full border border-[#dce4f6] bg-[#f5f8ff] px-2.5 py-1 text-xs font-medium text-[#63708a]">Pendiente de primer acceso</span> : formatDate(member.lastSignedIn)}</td><td className="px-5 py-4">{canManage ? <select value={member.role} onChange={event => applyRole(member.id, event.target.value as "socio_1" | "socio_2" | "participante" | "contador" | "admin" | "user")} disabled={assignRole.isPending} className="glass-input h-9 min-w-[190px] px-3 text-xs"><option value="user">Usuario sin asignar</option><option value="socio_1">Socio 1 (Ing. Angomas)</option><option value="socio_2">Socio 2 (Ing. Johan)</option><option value="participante">Participante</option><option value="contador">Contador</option><option value="admin">Administrador</option></select> : <span className="inline-flex items-center gap-1 text-xs text-[#8b96ab]"><ShieldCheck className="h-3.5 w-3.5" />Solo lectura</span>}</td></tr>)}
            </tbody>
          </table>
        </div>
        {users.isLoading ? <div className="p-6 text-sm text-[#71809a]">Cargando usuarios…</div> : null}
        {!users.isLoading && (users.data?.length ?? 0) === 0 ? <div className="flex items-center gap-3 p-6 text-sm text-[#71809a]"><UserCog className="h-5 w-5" />Los usuarios aparecerán aquí cuando inicien sesión por primera vez.</div> : null}
      </CardContent>
    </Card>
  </div>;
}
