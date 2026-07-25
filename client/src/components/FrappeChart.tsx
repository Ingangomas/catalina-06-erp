import { useEffect, useRef } from "react";

type FrappeChartProps = {
  type: "bar" | "line" | "pie";
  labels: string[];
  datasets: Array<{ name: string; values: number[] }>;
  colors: string[];
  height?: number;
};

export default function FrappeChart({ type, labels, datasets, colors, height = 260 }: FrappeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || labels.length === 0) return;
    let disposed = false;
    container.replaceChildren();

    void import("frappe-charts").then(module => {
      if (disposed || !container) return;
      const Chart = (module as unknown as { Chart?: new (element: HTMLElement, config: unknown) => unknown; default?: new (element: HTMLElement, config: unknown) => unknown }).Chart
        ?? (module as unknown as { default?: new (element: HTMLElement, config: unknown) => unknown }).default;
      if (!Chart) return;
      new Chart(container, {
        type,
        height,
        colors,
        data: { labels, datasets },
        axisOptions: { xAxisMode: "tick", yAxisMode: "tick", xIsSeries: true },
        lineOptions: { hideDots: 0, regionFill: 1 },
        barOptions: { stacked: false, spaceRatio: 0.36 },
        tooltipOptions: {
          formatTooltipY: (value: number) => new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0 }).format(value),
        },
      });
    });

    return () => {
      disposed = true;
      container.replaceChildren();
    };
  }, [colors, datasets, height, labels, type]);

  if (labels.length === 0 || datasets.every(dataset => dataset.values.every(value => value === 0))) {
    return <div className="grid h-[260px] place-items-center rounded-xl bg-[#fbfaf8] text-sm text-slate-500">Sin movimiento para este período.</div>;
  }

  return <div ref={containerRef} className="w-full overflow-hidden" aria-label={`Gráfico ${type}`} />;
}
