import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { currentMonthValue, formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { EXPENSE_TYPE_LABELS } from "@shared/expenseConstants";
import { Archive, Download, FileSpreadsheet, ImageDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const MONTH_FOLDER_LABELS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function evidenceFolderName(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${MONTH_FOLDER_LABELS[Number(monthNumber) - 1] ?? "periodo"}-${year}`;
}

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonthValue);
  const evidenceFolder = evidenceFolderName(month);
  const report = trpc.reports.monthly.useQuery({ month }, { enabled: false });
  const evidencePackage = trpc.reports.evidencePackage.useMutation();
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

  const downloadEvidencePackage = async () => {
    try {
      const result = await evidencePackage.mutateAsync({ month });
      const anchor = document.createElement("a");
      anchor.href = result.url;
      anchor.download = result.filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success(
        result.evidenceCount > 0
          ? `Paquete mensual generado con ${result.evidenceCount} evidencia${result.evidenceCount === 1 ? "" : "s"}.`
          : "Paquete mensual generado. No hay evidencias archivadas en este período.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible preparar el paquete de evidencias.");
    }
  };

  return <div className="mx-auto max-w-5xl space-y-6"><section><p className="page-eyebrow">Cierre financiero</p><h1 className="page-title mt-1">Reportes mensuales</h1><p className="page-lede mt-2">Genera el reporte financiero y, cuando lo necesites, una copia organizada de las facturas y fotografías archivadas del mismo período.</p></section><Card className="surface-card"><CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end"><label className="grid max-w-xs gap-1.5 text-sm font-semibold text-[#44546f]">Mes a reportar<input value={month} onChange={event => setMonth(event.target.value)} type="month" className="glass-input" /></label><Button onClick={download} disabled={report.isFetching} variant="outline" className="h-11"><>{report.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Descargar CSV</></Button><Button onClick={downloadEvidencePackage} disabled={evidencePackage.isPending} className="h-11">{evidencePackage.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}Exportar reporte + fotos</Button></CardContent></Card><Card className="border-[#cbd8f5] bg-[#f7f9ff]/80"><CardContent className="flex gap-4 p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#3a5ccc] shadow-sm"><ImageDown className="h-5 w-5" /></span><div><h2 className="font-semibold text-[#1c2942]">Paquete organizado por mes</h2><p className="mt-1 text-sm leading-6 text-[#62718b]">La exportación crea un ZIP con el CSV, un inventario y las evidencias dentro de <strong>evidencias/{evidenceFolder}</strong>. Los archivos originales no se modifican ni se eliminan.</p></div></CardContent></Card>{summary ? <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard label="Total general" value={formatCurrency(summary.grandTotal)} /><SummaryCard label="Registros" value={String(summary.expenseCount)} />{summary.typeTotals.map(item => <SummaryCard key={item.expenseType} label={EXPENSE_TYPE_LABELS[item.expenseType]} value={formatCurrency(item.total)} />)}</section> : <Card className="border-dashed border-[#c9d4f0] bg-white/46"><CardContent className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eef2ff] text-[#637de1]"><FileSpreadsheet className="h-5 w-5" /></span><h2 className="mt-4 font-semibold text-[#1c2942]">El reporte estará listo al descargarlo</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#6c7890]">El proceso revisa los datos del período en el servidor y prepara un CSV organizado por resumen, categoría y detalle.</p></CardContent></Card>}</div>;
}

function SummaryCard({ label, value }: { label: string; value: string }) { return <Card className="surface-card"><CardContent className="p-5"><p className="text-sm text-[#6c7890]">{label}</p><p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#1c2942]">{value}</p></CardContent></Card>; }
