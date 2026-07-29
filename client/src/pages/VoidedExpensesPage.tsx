import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMonthValue, formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Archive, FileWarning, Paperclip, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

type VoidedExpense = {
  id: number;
  description: string;
  amount: number;
  incurredOn: Date | string;
  reportingMonth: string;
  category: { id: number; label: string; color: string };
  createdBy: { id: number; name: string | null; email: string | null };
  previousStatus: string;
  voidReason: string;
  voidedAt: Date | string;
  voidedBy: { id: number; name: string | null; email: string | null } | null;
  invoices: Array<{ id: number; originalName: string; fileUrl: string; storageKey: string }>;
};

export default function VoidedExpensesPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonthValue);
  const input = useMemo(() => ({ month }), [month]);
  const auditQuery = trpc.expenses.listVoided.useQuery(input, { enabled: user?.role === "contador" || user?.role === "admin" });
  const records = (auditQuery.data ?? []) as VoidedExpense[];

  if (user?.role !== "contador" && user?.role !== "admin") {
    return <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Esta vista está disponible para Contador y Administrador.</div>;
  }

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="page-eyebrow">Gobernanza y evidencia</p>
        <h1 className="page-title mt-1">Auditoría de gastos anulados</h1>
        <p className="page-lede mt-2 max-w-3xl">Los gastos anulados no participan en los totales operativos. Esta vista conserva el motivo, la persona que ejecutó la acción y los enlaces de evidencia para revisión contable.</p>
      </div>
      <label className="grid gap-1.5 text-xs font-semibold text-[#44546f]">Mes de registro<input value={month} onChange={event => setMonth(event.target.value)} type="month" className="glass-input" /></label>
    </section>

    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <MetricCard label="Registros anulados" value={String(records.length)} icon={<Archive className="h-5 w-5" />} tone="bg-[#f1f4ff] text-[#657fe0]" />
      <MetricCard label="Evidencias preservadas" value={String(records.reduce((total, record) => total + record.invoices.length, 0))} icon={<Paperclip className="h-5 w-5" />} tone="bg-[#eaf6ff] text-[#4c83bc]" />
      <MetricCard label="Control de acceso" value="Restringido" icon={<ShieldCheck className="h-5 w-5" />} tone="bg-[#e9f8f3] text-[#398f72]" />
    </div>

    <Card className="surface-card overflow-hidden">
      <CardHeader className="flex-row items-center gap-3 border-b border-[#e5eaf6] pb-4"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eef2ff] text-[#657fe0]"><FileWarning className="h-5 w-5" /></span><div><CardTitle className="text-lg text-[#1c2942]">Historial conservado</CardTitle><p className="mt-1 text-xs font-normal text-[#6c7890]">Las referencias S3 se mantienen disponibles para auditoría; aquí no existe una acción de eliminación.</p></div></CardHeader>
      <CardContent className="p-0">
        {auditQuery.isError ? <div className="grid min-h-64 place-items-center p-8 text-center"><div><FileWarning className="mx-auto h-7 w-7 text-[#be554e]" /><h2 className="mt-3 font-semibold text-[#253142]">No fue posible cargar la auditoría</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">La información no se modificó. Comprueba la conexión o intenta cargar el historial nuevamente.</p><Button onClick={() => auditQuery.refetch()} variant="outline" className="mt-5 border-[#d89637] text-[#8d5e1d] hover:bg-[#fff4dc]">Reintentar</Button></div></div> : null}
        {!auditQuery.isError && auditQuery.isLoading ? <div className="p-7 text-sm text-slate-500">Cargando historial de auditoría…</div> : null}
        {!auditQuery.isError && !auditQuery.isLoading && records.length === 0 ? <div className="grid min-h-64 place-items-center p-8 text-center"><div><Archive className="mx-auto h-7 w-7 text-[#b98232]" /><h2 className="mt-3 font-semibold text-[#253142]">No hay gastos anulados en este período</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Cuando Contador o Administrador anule un gasto, su registro aparecerá aquí con el motivo y las evidencias preservadas.</p></div></div> : null}
        {!auditQuery.isError && records.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[1240px] text-left text-sm"><thead className="bg-white/48 text-xs font-bold uppercase tracking-wide text-[#71809a]"><tr><th className="px-5 py-3">Gasto</th><th className="px-5 py-3">Monto</th><th className="px-5 py-3">Motivo y estado previo</th><th className="px-5 py-3">Anulado por</th><th className="px-5 py-3">Fecha de anulación</th><th className="px-5 py-3">Evidencias preservadas</th></tr></thead><tbody className="divide-y divide-[#e5eaf6]">{records.map(record => <tr key={record.id} className="align-top hover:bg-white/42"><td className="px-5 py-4"><p className="font-medium text-[#1c2942]">{record.description}</p><p className="mt-1 text-xs text-[#71809a]"><span className="mr-2 inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: record.category.color }} />{record.category.label}</span>· Registro {formatDate(record.incurredOn)}</p></td><td className="px-5 py-4 font-semibold text-[#1c2942]">{formatCurrency(record.amount)}</td><td className="px-5 py-4"><p className="max-w-xs text-[#3b4b68]">{record.voidReason}</p><p className="mt-1 text-xs text-[#71809a]">Estado previo: {record.previousStatus}</p></td><td className="px-5 py-4 text-[#53617a]">{record.voidedBy?.name || record.voidedBy?.email || "Sin usuario registrado"}</td><td className="px-5 py-4 text-[#64718a]">{formatDate(record.voidedAt)}</td><td className="px-5 py-4"><div className="flex min-w-[230px] flex-wrap gap-2">{record.invoices.length ? record.invoices.map(invoice => <a key={invoice.id} href={invoice.fileUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-white/80 bg-white/66 px-2.5 py-1 text-xs font-medium text-[#50617e] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-white"><Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{invoice.originalName}</span></a>) : <span className="text-xs text-[#71809a]">Sin evidencia adjunta</span>}</div></td></tr>)}</tbody></table></div> : null}
      </CardContent>
    </Card>
  </div>;
}

function MetricCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return <Card className="surface-card"><CardContent className="flex items-center gap-4 p-5"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}>{icon}</span><div><p className="text-sm text-[#6c7890]">{label}</p><p className="mt-1 text-xl font-semibold tracking-[-0.04em] text-[#1c2942]">{value}</p></div></CardContent></Card>;
}
