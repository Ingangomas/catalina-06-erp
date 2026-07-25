export type ExpenseGridStyle = {
  targetType: "row" | "column";
  targetKey: string;
  backgroundColor: string;
};

export function appendGridRow<T>(rows: readonly T[], row: T) {
  return [...rows, row];
}

export function removeGridRow<T extends { key: string }>(rows: readonly T[], key: string) {
  return rows.filter(row => row.key !== key);
}

export function resolveGridColor(
  styles: readonly ExpenseGridStyle[],
  targetType: ExpenseGridStyle["targetType"],
  targetKey: string,
  fallback: string,
) {
  return styles.find(style => style.targetType === targetType && style.targetKey === targetKey)?.backgroundColor ?? fallback;
}
