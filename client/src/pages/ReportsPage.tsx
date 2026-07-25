import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMonthValue, formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { EXPENSE_TYPE_LABELS } from "@shared/expenseConstants";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonthValue);
  const report = trpc.reports.monthly.useQuery({ month }, { enabled: false });
  const summary = report.data?.summary as { grandTotal: number; expenseCount: number; typeTotals: Array<{ expenseType: keyof typeof EXPENSE_TYPE_LABELS; total: number }> } | undefined;

  const download = async () => {
    const result = await report.refetch();
    if (!result.data) { toast.error("No fue posible generar el reporte."); return; }
    const blob = new Blob([result.data.csv as string], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.data.filename as string;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Reporte mensual descargado.");
  };

  return <div className="mx-auto max-w-5xl space-y-6"><section><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b7135]">Cierre financiero</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#253142]">Reportes mensuales</h1><p className="mt-2 text-sm text-slate-600">Genera un archivo estructurado con Polars que reúne el detalle, los totales por socio y el gasto global.</p></section><Card className="border-[#e7e0d5] bg-white shadow-sm"><CardContent className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-end"><label className="grid max-w-xs gap-1.5 text-sm font-medium text-[#354255]">Mes a reportar<input value={month} onChange={event => setMonth(event.target.value)} type="month" className="h-11 rounded-lg border border-[#ddd5c9] bg-white px-3 text-sm text-[#253142] outline-none focus:border-[#d89637]" /></label><Button onClick={download} disabled={report.isFetching} className="h-11 bg-[#253142] text-white hover:bg-[#18212d]">{report.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Descargar reporte CSV</Button></CardContent></Card>{summary ? <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard label="Total general" value={formatCurrency(summary.grandTotal)} /><SummaryCard label="Registros" value={String(summary.expenseCount)} />{summary.typeTotals.map(item => <SummaryCard key={item.expenseType} label={EXPENSE_TYPE_LABELS[item.expenseType]} value={formatCurrency(item.total)} />)}</section> : <Card className="border-dashed border-[#d9d0c2] bg-[#fbfaf8]"><CardContent className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f4efe7] text-[#b98232]"><FileSpreadsheet className="h-5 w-5" /></span><h2 className="mt-4 font-semibold text-[#253142]">El reporte estará listo al descargarlo</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">El proceso revisa los datos del período en el servidor y prepara un CSV organizado por resumen, categoría y detalle.</p></CardContent></Card>}</div>;
}

function SummaryCard({ label, value }: { label: string; value: string }) { return <Card className="border-[#e7e0d5] bg-white shadow-sm"><CardContent className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold tracking-tight text-[#253142]">{value}</p></CardContent></Card>; }
