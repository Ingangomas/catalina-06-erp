"""Genera analíticas y exportaciones mensuales con Polars desde JSON por stdin."""

import csv
import io
import json
import sys
from typing import Any

import polars as pl

CATEGORY_ORDER = ["Materiales", "Mano de Obra", "Transporte", "Botes", "Otros"]
TYPE_ORDER = ["socio_1", "socio_2", "participant", "global_shared"]


def expense_type_label(value: str) -> str:
    labels = {
        "socio_1": "Socio 1",
        "socio_2": "Socio 2",
        "participant": "Participante",
        "global_shared": "Global/Compartido",
    }
    return labels.get(value, value)


def empty_frame() -> pl.DataFrame:
    return pl.DataFrame(
        schema={
            "id": pl.Int64,
            "description": pl.String,
            "amount": pl.Float64,
            "incurredOn": pl.String,
            "reportingMonth": pl.String,
            "expenseType": pl.String,
            "status": pl.String,
            "category": pl.String,
            "createdBy": pl.String,
        }
    )


def normalize_records(records: list[dict[str, Any]]) -> pl.DataFrame:
    if not records:
        return empty_frame()

    normalized = [
        {
            "id": item.get("id"),
            "description": item.get("description", ""),
            "amount": item.get("amount", 0),
            "incurredOn": str(item.get("incurredOn", "")),
            "reportingMonth": item.get("reportingMonth", ""),
            "expenseType": item.get("expenseType", ""),
            "status": item.get("status", ""),
            "category": item.get("category", {}).get("label", "Otros"),
            "createdBy": item.get("createdBy", {}).get("name") or "Sin nombre",
        }
        for item in records
    ]
    return pl.DataFrame(normalized).with_columns(
        pl.col("amount").cast(pl.Float64, strict=False).fill_null(0.0)
    )


def totals_by_type(frame: pl.DataFrame) -> list[dict[str, Any]]:
    if frame.is_empty():
        return [{"expenseType": value, "total": 0.0} for value in TYPE_ORDER]

    grouped = frame.group_by("expenseType").agg(pl.col("amount").sum().alias("total"))
    values = {item["expenseType"]: float(item["total"]) for item in grouped.to_dicts()}
    return [{"expenseType": value, "total": round(values.get(value, 0.0), 2)} for value in TYPE_ORDER]


def totals_by_category(frame: pl.DataFrame) -> list[dict[str, Any]]:
    if frame.is_empty():
        return [{"category": value, "total": 0.0} for value in CATEGORY_ORDER]

    grouped = frame.group_by("category").agg(pl.col("amount").sum().alias("total"))
    values = {item["category"]: float(item["total"]) for item in grouped.to_dicts()}
    return [{"category": value, "total": round(values.get(value, 0.0), 2)} for value in CATEGORY_ORDER]


def trend_by_month(frame: pl.DataFrame) -> list[dict[str, Any]]:
    if frame.is_empty():
        return []
    return [
        {"month": item["reportingMonth"], "total": round(float(item["total"]), 2)}
        for item in frame.group_by("reportingMonth").agg(pl.col("amount").sum().alias("total")).sort("reportingMonth").to_dicts()
    ]


def analytics(frame: pl.DataFrame, selected_month: str) -> dict[str, Any]:
    monthly = frame.filter(pl.col("reportingMonth") == selected_month)
    type_totals = totals_by_type(monthly)
    total = round(sum(item["total"] for item in type_totals), 2)
    status_totals = (
        monthly.group_by("status").len().rename({"len": "count"}).to_dicts()
        if not monthly.is_empty()
        else []
    )
    return {
        "month": selected_month,
        "grandTotal": total,
        "expenseCount": monthly.height,
        "typeTotals": type_totals,
        "categoryTotals": totals_by_category(monthly),
        "trend": trend_by_month(frame),
        "statusCounts": status_totals,
    }


def csv_section(title: str, headers: list[str], rows: list[list[Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([title])
    writer.writerow(headers)
    writer.writerows(rows)
    writer.writerow([])
    return buffer.getvalue()


def monthly_report(frame: pl.DataFrame, selected_month: str) -> dict[str, Any]:
    monthly = frame.filter(pl.col("reportingMonth") == selected_month)
    type_totals = totals_by_type(monthly)
    category_totals = totals_by_category(monthly)
    summary_rows = [[expense_type_label(item["expenseType"]), f"{item['total']:.2f}"] for item in type_totals]
    summary_rows.append(["Total general", f"{sum(item['total'] for item in type_totals):.2f}"])
    category_rows = [[item["category"], f"{item['total']:.2f}"] for item in category_totals]
    detail_rows = (
        monthly.sort(["incurredOn", "id"])
        .select(["incurredOn", "description", "category", "expenseType", "createdBy", "status", "amount"])
        .to_dicts()
    )
    detail_csv_rows = [
        [
            item["incurredOn"],
            item["description"],
            item["category"],
            expense_type_label(item["expenseType"]),
            item["createdBy"],
            item["status"],
            f"{float(item['amount']):.2f}",
        ]
        for item in detail_rows
    ]
    report = ""
    report += csv_section(f"REPORTE MENSUAL CATALINA #06 — {selected_month}", ["Tipo de gasto", "Monto DOP"], summary_rows)
    report += csv_section("GASTOS POR CATEGORÍA", ["Categoría", "Monto DOP"], category_rows)
    report += csv_section("DETALLE DE GASTOS", ["Fecha", "Descripción", "Categoría", "Tipo", "Registrado por", "Estado", "Monto DOP"], detail_csv_rows)
    return {
        "filename": f"catalina-06-gastos-{selected_month}.csv",
        "csv": report,
        "summary": analytics(frame, selected_month),
    }


def main() -> None:
    payload = json.load(sys.stdin)
    frame = normalize_records(payload.get("expenses", []))
    selected_month = payload.get("selectedMonth", "")
    result = monthly_report(frame, selected_month) if payload.get("mode") == "monthly_report" else analytics(frame, selected_month)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
