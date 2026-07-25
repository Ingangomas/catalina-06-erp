import FrappeChart from "@/components/FrappeChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMonthValue, formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { EXPENSE_TYPE_LABELS, USER_ROLE_LABELS } from "@shared/expenseConstants";
import { AlertCircle, ArrowDownToLine, CheckCircle2, Clock3, ReceiptText, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

const typeColors = ["#E9A23B", "#4667D9", "#39A77E"];

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonthValue);
  const { user } = useAuth();
  const analytics = trpc.dashboard.analytics.useQuery({ month });
  const data = analytics.data as {
    grandTotal: number;
    expenseCount: number;
    typeTotals: Array<{ expenseType: keyof typeof EXPENSE_TYPE_LABELS; total: number }>;
    categoryTotals: Array<{ category: string; total: number }>;
    trend: Array<{ month: string; total: number }>;
    statusCounts: Array<{ status: string; count: number }>;
  } | undefined;
  const statusCounts = useMemo(() => new Map(data?.statusCounts?.map(item => [item.status, item.count]) ?? []), [data?.statusCounts]);
  const role = user?.role as keyof typeof USER_ROLE_LABELS | undefined;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="overflow-hidden rounded-[1.75rem] bg-[#253142] px-6 py-7 text-white shadow-[0_20px_45px_rgba(37,49,66,0.16)] sm:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#efbd71]">Control financiero de obra</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Panorama mensual</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Seguimiento consolidado de gastos propios, gastos del otro socio y compromisos globales del proyecto Catalina #06.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-slate-300">
              Período de consulta
              <input value={month} onChange={event => setMonth(event.target.value)} type="month" className="h-10 rounded-lg border border-white/20 bg-white/10 px-3 text-sm text-white outline-none focus:border-[#efbd71]" />
            </label>
            <Link href="/gastos">
              <Button className="h-10 bg-[#d89637] text-white hover:bg-[#c68227]">Registrar gasto</Button>
            </Link>
          </div>
        </div>
        {role ? <p className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">Vista activa: {USER_ROLE_LABELS[role]}</p> : null}
      </section>

      {analytics.isError ? <ErrorPanel message="No fue posible cargar el resumen. Intenta actualizar la página." /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Gasto del período" value={formatCurrency(data?.grandTotal)} icon={WalletCards} accent="amber" loading={analytics.isLoading} />
        <MetricCard label="Registros" value={String(data?.expenseCount ?? 0)} icon={ReceiptText} accent="blue" loading={analytics.isLoading} />
        <MetricCard label="Pendientes de revisión" value={String(statusCounts.get("submitted") ?? 0)} icon={Clock3} accent="violet" loading={analytics.isLoading} />
        <MetricCard label="Aprobados" value={String(statusCounts.get("approved") ?? 0)} icon={CheckCircle2} accent="green" loading={analytics.isLoading} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <Card className="border-[#e7e0d5] bg-white shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b7135]">Distribución</p>
              <CardTitle className="mt-1 text-lg text-[#253142]">Gastos por categoría</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <FrappeChart
              type="bar"
              labels={data?.categoryTotals.map(item => item.category) ?? []}
              datasets={[{ name: "Monto", values: data?.categoryTotals.map(item => item.total) ?? [] }]}
              colors={["#d89637"]}
            />
          </CardContent>
        </Card>
        <Card className="border-[#e7e0d5] bg-white shadow-sm">
          <CardHeader className="pb-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b7135]">Participación</p>
            <CardTitle className="mt-1 text-lg text-[#253142]">Gasto por responsable</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <FrappeChart
              type="pie"
              labels={data?.typeTotals.map(item => EXPENSE_TYPE_LABELS[item.expenseType]) ?? []}
              datasets={[{ name: "Monto", values: data?.typeTotals.map(item => item.total) ?? [] }]}
              colors={typeColors}
            />
          </CardContent>
        </Card>
      </section>

      <Card className="border-[#e7e0d5] bg-white shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b7135]">Tendencia</p>
            <CardTitle className="mt-1 text-lg text-[#253142]">Evolución mensual de gasto</CardTitle>
          </div>
          <Link href="/reportes"><Button variant="outline" className="border-[#ded6c8] text-[#253142]"><ArrowDownToLine className="mr-2 h-4 w-4" />Reporte mensual</Button></Link>
        </CardHeader>
        <CardContent className="pt-4">
          <FrappeChart
            type="line"
            labels={data?.trend.map(item => item.month) ?? []}
            datasets={[{ name: "Monto", values: data?.trend.map(item => item.total) ?? [] }]}
            colors={["#4667D9"]}
            height={290}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, accent, loading }: { label: string; value: string; icon: typeof WalletCards; accent: "amber" | "blue" | "violet" | "green"; loading: boolean }) {
  const styles = {
    amber: "bg-[#fff4df] text-[#bb7c1d]",
    blue: "bg-[#eef1ff] text-[#4667d9]",
    violet: "bg-[#f2efff] text-[#7458ca]",
    green: "bg-[#e8f8ef] text-[#21845d]",
  };
  return <Card className="border-[#e7e0d5] bg-white shadow-sm"><CardContent className="flex items-center gap-4 p-5"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${styles[accent]}`}><Icon className="h-5 w-5" /></span><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight text-[#253142]">{loading ? "…" : value}</p></div></CardContent></Card>;
}

function ErrorPanel({ message }: { message: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{message}</div>;
}
