import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { USER_ROLE_LABELS } from "@shared/expenseConstants";
import {
  BarChart3,
  FileSpreadsheet,
  HardHat,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./ui/sidebar";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

type ProjectRole = keyof typeof USER_ROLE_LABELS;

const navItems = [
  { label: "Resumen", path: "/", icon: LayoutDashboard, roles: ["socio_1", "socio_2", "participante", "contador", "admin"] },
  { label: "Gastos", path: "/gastos", icon: ReceiptText, roles: ["socio_1", "socio_2", "participante", "contador", "admin"] },
  { label: "Reportes", path: "/reportes", icon: FileSpreadsheet, roles: ["socio_1", "socio_2", "participante", "contador", "admin"] },
  { label: "Equipo y roles", path: "/equipo", icon: ShieldCheck, roles: ["contador", "admin"] },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f8f6f1] px-5 text-[#253142]">
        <section className="w-full max-w-md rounded-[2rem] border border-[#e8e0d2] bg-white p-8 shadow-[0_24px_70px_rgba(49,57,74,0.12)]">
          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d89637] text-white shadow-lg shadow-[#d89637]/25">
            <HardHat className="h-7 w-7" />
          </div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#9b7135]">Catalina #06</p>
          <h1 className="text-3xl font-semibold tracking-tight">Control de gastos de obra</h1>
          <p className="mt-3 leading-6 text-slate-600">Inicia sesión para registrar gastos, adjuntar facturas y consultar el seguimiento financiero del proyecto.</p>
          <Button onClick={() => startLogin()} className="mt-8 w-full bg-[#253142] text-white hover:bg-[#18212d]" size="lg">
            Iniciar sesión
          </Button>
        </section>
      </main>
    );
  }

  const role = user.role as ProjectRole;
  return (
    <SidebarProvider>
      <ProjectSidebar role={role} />
      <SidebarInset className="min-w-0 bg-[#f8f6f1]">
        <ProjectTopbar />
        <main className="min-h-[calc(100vh-4.5rem)] px-4 py-5 sm:px-7 sm:py-7">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ProjectSidebar({ role }: { role: ProjectRole }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const allowedItems = navItems.filter(item => item.roles.includes(role as never));

  return (
    <Sidebar collapsible="icon" className="border-r border-[#e6dfd4] bg-[#253142] text-[#eef1f4]">
      <SidebarHeader className="h-[4.5rem] border-b border-white/10 px-3 py-3">
        <button
          onClick={() => setLocation("/")}
          className="flex w-full items-center gap-3 rounded-xl px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#e9a23b]"
          aria-label="Ir al resumen"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#d89637] text-white shadow-lg shadow-black/10">
            <HardHat className="h-5 w-5" />
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold tracking-wide">CATALINA #06</span>
            <span className="block truncate text-xs text-slate-300">Control financiero</span>
          </span>
        </button>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <p className="px-3 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400 group-data-[collapsible=icon]:hidden">Operación</p>
        <SidebarMenu>
          {allowedItems.map(item => {
            const active = location === item.path;
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={active}
                  onClick={() => setLocation(item.path)}
                  tooltip={item.label}
                  className={`h-11 rounded-xl px-3 text-slate-200 transition-all hover:bg-white/10 hover:text-white data-[active=true]:bg-[#d89637] data-[active=true]:text-white ${active ? "font-semibold" : ""}`}
                >
                  <item.icon className="h-[1.1rem] w-[1.1rem]" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-3">
        <div className="rounded-xl bg-white/5 p-2 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <div className="flex items-center gap-3 px-1">
            <Avatar className="h-9 w-9 border border-white/15">
              <AvatarFallback className="bg-[#415166] text-xs font-semibold text-white">
                {user?.name?.charAt(0)?.toUpperCase() || "C"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium text-white">{user?.name || "Usuario"}</p>
              <p className="mt-0.5 truncate text-xs text-slate-300">{USER_ROLE_LABELS[role]}</p>
            </div>
          </div>
          <Button
            onClick={logout}
            variant="ghost"
            className="mt-2 h-8 w-full justify-start px-2 text-xs text-slate-300 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:mt-2 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="ml-2 group-data-[collapsible=icon]:hidden">Cerrar sesión</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function ProjectTopbar() {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const label = navItems.find(item => item.path === location)?.label ?? "Resumen";

  return (
    <header className="sticky top-0 z-20 flex h-[4.5rem] items-center border-b border-[#e6dfd4] bg-[#f8f6f1]/92 px-4 backdrop-blur-sm sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        {isMobile ? <SidebarTrigger className="rounded-lg text-[#253142]"><Menu className="h-5 w-5" /></SidebarTrigger> : null}
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#9b7135]">Proyecto de remodelación</p>
          <h2 className="truncate text-lg font-semibold tracking-tight text-[#253142]">{label}</h2>
        </div>
      </div>
      <div className="ml-auto hidden items-center gap-2 text-sm text-slate-500 sm:flex">
        <BarChart3 className="h-4 w-4 text-[#d89637]" />
        <span>Datos financieros en tiempo real</span>
      </div>
    </header>
  );
}
