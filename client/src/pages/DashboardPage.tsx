import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMonthValue, formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { EXPENSE_TYPE_LABELS, USER_ROLE_LABELS } from "@shared/expenseConstants";
import { AlertCircle, ArrowDownToLine, CheckCircle2, Clock3, ReceiptText, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

const typeColors = ["#607be5", "#77b8d9", "#7ac9ac"];

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
      <section className="hero-surface rounded-[2rem] px-6 py-7 text-white sm:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#c3d0ff]">Control financiero de obra</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Panorama mensual</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c6d1e8]">Seguimiento consolidado de gastos propios, gastos del otro socio y compromisos globales del proyecto Catalina #06.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-[#c6d1e8]">
              Período de consulta
              <input value={month} onChange={event => setMonth(event.target.value)} type="month" className="h-10 rounded-full border border-white/15 bg-white/10 px-3 text-sm text-white outline-none backdrop-blur-xl focus:border-[#b5c6ff] focus:ring-4 focus:ring-[#b5c6ff]/20" />
            </label>
            <Link href="/gastos">
              <Button className="h-10 bg-white text-[#20304e] shadow-[0_10px_24px_rgba(11,20,42,0.20)] hover:bg-[#eff3ff]">Registrar gasto</Button>
            </Link>
          </div>
        </div>
        {role ? <p className="mt-6 inline-flex rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-medium text-[#d8e1f4] backdrop-blur-xl">Vista activa: {USER_ROLE_LABELS[role]}</p> : null}
      </section>

      {analytics.isError ? <ErrorPanel message="No fue posible cargar el resumen. Intenta actualizar la página." /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Gasto del período" value={formatCurrency(data?.grandTotal)} icon={WalletCards} accent="amber" loading={analytics.isLoading} />
        <MetricCard label="Registros" value={String(data?.expenseCount ?? 0)} icon={ReceiptText} accent="blue" loading={analytics.isLoading} />
        <MetricCard label="Pendientes de revisión" value={String(statusCounts.get("submitted") ?? 0)} icon={Clock3} accent="violet" loading={analytics.isLoading} />
        <MetricCard label="Aprobados" value={String(statusCounts.get("approved") ?? 0)} icon={CheckCircle2} accent="green" loading={analytics.isLoading} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
        <Card className="surface-card">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
            <div>
              <p className="page-eyebrow">Distribución</p>
              <CardTitle className="mt-1 text-lg text-[#1c2942]">Gastos por categoría</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <FrappeChart
              type="bar"
              labels={data?.categoryTotals.map(item => item.category) ?? []}
              datasets={[{ name: "Monto", values: data?.categoryTotals.map(item => item.total) ?? [] }]}
              colors={["#607be5"]}
            />
          </CardContent>
        </Card>
        <Card className="surface-card">
          <CardHeader className="pb-1">
            <p className="page-eyebrow">Participación</p>
            <CardTitle className="mt-1 text-lg text-[#1c2942]">Gasto por responsable</CardTitle>
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

      <Card className="surface-card">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
          <div>
            <p className="page-eyebrow">Tendencia</p>
            <CardTitle className="mt-1 text-lg text-[#1c2942]">Evolución mensual de gasto</CardTitle>
          </div>
          <Link href="/reportes"><Button variant="outline"><ArrowDownToLine className="mr-2 h-4 w-4" />Reporte mensual</Button></Link>
        </CardHeader>
        <CardContent className="pt-4">
          <FrappeChart
            type="line"
            labels={data?.trend.map(item => item.month) ?? []}
            datasets={[{ name: "Monto", values: data?.trend.map(item => item.total) ?? [] }]}
            colors={["#607be5"]}
            height={290}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, accent, loading }: { label: string; value: string; icon: typeof WalletCards; accent: "amber" | "blue" | "violet" | "green"; loading: boolean }) {
  const styles = {
    amber: "bg-[#f1f4ff] text-[#617ce0]",
    blue: "bg-[#eaf5ff] text-[#4c83bc]",
    violet: "bg-[#f1efff] text-[#7567c6]",
    green: "bg-[#e9f8f3] text-[#398f72]",
  };
  return <Card className="surface-card"><CardContent className="flex items-center gap-4 p-5"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${styles[accent]}`}><Icon className="h-5 w-5" /></span><div><p className="text-sm text-[#6c7890]">{label}</p><p className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-[#1c2942]">{loading ? "…" : value}</p></div></CardContent></Card>;
}

function ErrorPanel({ message }: { message: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{message}</div>;
}

type FrappeDataset = { name: string; values: number[] };
type FrappeChartProps = {
  type: "bar" | "pie" | "line";
  labels: string[];
  datasets: FrappeDataset[];
  colors: string[];
  height?: number;
};

function FrappeChart({ type, labels, datasets, colors, height = 250 }: FrappeChartProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const chartSignature = JSON.stringify({ type, labels, datasets, colors, height });

  useEffect(() => {
    let disposed = false;
    let chart: { destroy?: () => void } | undefined;

    const renderChart = async () => {
      const root = elementRef.current;
      if (!root || disposed) return;

      type ChartConstructor = new (element: HTMLElement, options: object) => { destroy?: () => void };
      const module = await import("frappe-charts");
      const exports = module as unknown as { Chart?: ChartConstructor; default?: ChartConstructor };
      const Chart = exports.Chart ?? exports.default;
      if (!Chart || disposed || !elementRef.current) return;

      elementRef.current.replaceChildren();
      chart = new Chart(elementRef.current, {
        type,
        height,
        animate: false,
        colors,
        data: { labels, datasets },
        axisOptions: { xIsSeries: true },
        tooltipOptions: { formatTooltipY: (value: number) => formatCurrency(value) },
      });
    };

    void renderChart();
    return () => {
      disposed = true;
      chart?.destroy?.();
    };
  }, [chartSignature]);

  return <div ref={elementRef} className="min-h-[220px] w-full [&_.chart-label]:fill-[#71809a] [&_.dataset-units]:fill-[#71809a]" />;
}
