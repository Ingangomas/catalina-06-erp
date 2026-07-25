import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currentMonthValue, formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { EXPENSE_STATUS_LABELS, EXPENSE_TYPE_LABELS, USER_ROLE_LABELS } from "@shared/expenseConstants";
import { appendGridRow, removeGridRow, resolveGridColor } from "@shared/expenseGrid";
import {
  Camera,
  Check,
  FileText,
  Loader2,
  Palette,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  UserRoundPen,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const allowedMimes = ["image/jpeg", "image/png", "application/pdf"] as const;
const typeOptions = [
  { value: "socio_1", label: "Socio 1" },
  { value: "socio_2", label: "Socio 2" },
  { value: "participant", label: "Participante" },
  { value: "global_shared", label: "Global/Compartido" },
] as const;
const gridColumns = [
  ["fecha", "Fecha"],
  ["descripcion", "Descripción"],
  ["categoria", "Categoría"],
  ["tipo", "Tipo"],
  ["responsable", "Responsable"],
  ["monto", "Monto"],
  ["evidencia", "Evidencia"],
  ["estado", "Estado"],
  ["acciones", "Acciones"],
] as const;

type ExpenseType = (typeof typeOptions)[number]["value"];
type ProjectRole = "user" | "socio_1" | "socio_2" | "participante" | "contador" | "admin";
type FormValues = {
  description: string;
  amount: string;
  incurredOn: string;
  reportingMonth: string;
  categoryId: string;
  expenseType: ExpenseType;
  chargedToUserId: string;
};
type ExpenseRow = {
  id: number;
  description: string;
  amount: number;
  incurredOn: Date | string;
  reportingMonth: string;
  expenseType: ExpenseType;
  status: keyof typeof EXPENSE_STATUS_LABELS;
  category: { id: number; label: string; color: string };
  createdByUserId: number;
  chargedToUserId: number | null;
  chargedTo: { id: number; name: string | null; email: string | null; role: ProjectRole } | null;
  createdBy: { id: number; name: string | null; email: string | null; role: ProjectRole };
  invoices: Array<{ id: number; fileUrl: string; originalName: string }>;
  approval: { comments: string | null } | null;
};
type Category = { id: number; label: string; color: string };
type ProjectMember = { id: number; name: string | null; displayName: string | null; email: string | null; role: ProjectRole };

function toIsoDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function makeBlankRow(month: string, role?: string): FormValues {
  const expenseType = role === "socio_2" ? "socio_2" : role === "participante" ? "participant" : role === "socio_1" ? "socio_1" : "global_shared";
  return {
    description: "",
    amount: "",
    incurredOn: new Date().toISOString().slice(0, 10),
    reportingMonth: month,
    categoryId: "",
    expenseType,
    chargedToUserId: "",
  };
}

function toFormValues(expense: ExpenseRow): FormValues {
  return {
    description: expense.description,
    amount: String(expense.amount),
    incurredOn: toIsoDate(expense.incurredOn),
    reportingMonth: expense.reportingMonth,
    categoryId: String(expense.category.id),
    expenseType: expense.expenseType,
    chargedToUserId: expense.chargedToUserId ? String(expense.chargedToUserId) : "",
  };
}

function getVisibleTypes(role?: string) {
  if (role === "admin" || role === "contador") return typeOptions;
  if (role === "socio_1") return typeOptions.filter(option => option.value === "socio_1" || option.value === "global_shared");
  if (role === "socio_2") return typeOptions.filter(option => option.value === "socio_2" || option.value === "global_shared");
  if (role === "participante") return typeOptions.filter(option => option.value === "participant" || option.value === "global_shared");
  return [];
}

function memberDisplayName(member: ProjectMember) {
  return member.displayName || member.name || `Usuario ${member.id}`;
}

export default function ExpensesPage() {
  const [month, setMonth] = useState(currentMonthValue);
  const [dialog, setDialog] = useState<{ expense?: ExpenseRow; initialFile?: File } | null>(null);
  const [editingRows, setEditingRows] = useState<Record<number, FormValues>>({});
  const [quickRows, setQuickRows] = useState<Array<{ key: string; values: FormValues }>>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const utilities = trpc.useUtils();
  const listQuery = trpc.expenses.list.useQuery({ month });
  const categoriesQuery = trpc.categories.list.useQuery();
  const isPrivileged = user?.role === "contador" || user?.role === "admin";
  const membersQuery = trpc.projectUsers.list.useQuery(undefined, { enabled: isPrivileged });
  const stylesQuery = trpc.expenseGrid.styles.useQuery(undefined, { enabled: user?.role !== "user" && Boolean(user) });
  const updateExpense = trpc.expenses.update.useMutation({
    onSuccess: () => invalidateFinancialQueries(utilities),
  });
  const createExpense = trpc.expenses.create.useMutation({
    onSuccess: () => invalidateFinancialQueries(utilities),
  });
  const reviewMutation = trpc.expenses.review.useMutation({
    onSuccess: () => invalidateFinancialQueries(utilities),
  });
  const setGridStyle = trpc.expenseGrid.setStyle.useMutation({
    onSuccess: () => utilities.expenseGrid.styles.invalidate(),
  });
  const setExpenseName = trpc.profile.setExpenseName.useMutation({
    onSuccess: () => utilities.auth.me.invalidate(),
  });
  const canCreate = ["socio_1", "socio_2", "participante", "contador", "admin"].includes(user?.role ?? "");
  const members = (membersQuery.data ?? []) as ProjectMember[];
  const categories = (categoriesQuery.data ?? []) as Category[];
  const rows = (listQuery.data ?? []) as ExpenseRow[];
  const gridStyles = stylesQuery.data ?? [];

  const handleReview = async (expenseId: number, decision: "approved" | "rejected") => {
    const comments = window.prompt(
      decision === "approved" ? "Comentario de aprobación (opcional)" : "Indica el motivo del rechazo",
    ) ?? "";
    if (decision === "rejected" && !comments.trim()) {
      toast.error("Debes explicar el motivo del rechazo.");
      return;
    }
    try {
      await reviewMutation.mutateAsync({ expenseId, decision, comments });
      toast.success(decision === "approved" ? "Gasto aprobado." : "Gasto rechazado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible completar la revisión.");
    }
  };

  const saveInlineEdit = async (expense: ExpenseRow) => {
    const values = editingRows[expense.id];
    if (!values) return;
    const payload = validateValues(values, isPrivileged);
    if (!payload) return;
    try {
      await updateExpense.mutateAsync({ expenseId: expense.id, ...payload });
      setEditingRows(current => {
        const next = { ...current };
        delete next[expense.id];
        return next;
      });
      toast.success("Gasto actualizado. Volvió a borrador para una nueva revisión.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible editar el gasto.");
    }
  };

  const saveQuickRow = async (key: string, values: FormValues) => {
    const payload = validateValues(values, isPrivileged);
    if (!payload) return;
    try {
      await createExpense.mutateAsync(payload);
      setQuickRows(current => removeGridRow(current, key));
      toast.success("Fila guardada como borrador. Puedes añadir la factura desde Editar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar la fila.");
    }
  };

  const saveGridColor = async (targetType: "row" | "column", targetKey: string, backgroundColor: string) => {
    try {
      await setGridStyle.mutateAsync({ targetType, targetKey, backgroundColor });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar el color.");
    }
  };

  const handleCameraChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) setDialog({ initialFile: selected });
    event.target.value = "";
  };

  const renameMyExpenseIdentity = async () => {
    const nextName = window.prompt("Nombre que aparecerá al registrar gastos", user?.name ?? "")?.trim();
    if (!nextName) return;
    try {
      await setExpenseName.mutateAsync({ displayName: nextName });
      toast.success("Tu nombre de gasto se actualizó.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el nombre.");
    }
  };

  return (
    <div className="mx-auto max-w-[1680px] space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b7135]">Registro operativo</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#253142]">Gastos, facturas y cuadrícula</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Edita registros, organiza filas como una hoja de cálculo y toma fotografías de facturas desde el móvil. La lectura asistida propone los datos; tú los revisas antes de guardarlos.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">Período<input value={month} onChange={event => setMonth(event.target.value)} type="month" className="h-10 rounded-lg border border-[#ddd5c9] bg-white px-3 text-sm text-[#253142] outline-none focus:border-[#d89637]" /></label>
          {canCreate ? <Button onClick={() => setQuickRows(current => appendGridRow(current, { key: crypto.randomUUID(), values: makeBlankRow(month, user?.role) }))} variant="outline" className="h-10 border-[#cfc4b3] bg-white text-[#354255] hover:bg-[#f8f4ec]"><Plus className="mr-2 h-4 w-4" />Insertar fila</Button> : null}
          {canCreate ? <Button onClick={() => cameraInputRef.current?.click()} variant="outline" className="h-10 border-[#d6c3a3] bg-[#fffaf0] text-[#82581d] hover:bg-[#fff4dc]"><Camera className="mr-2 h-4 w-4" />Tomar foto</Button> : null}
          {canCreate ? <Button onClick={() => setDialog({})} className="h-10 bg-[#253142] text-white hover:bg-[#18212d]"><Plus className="mr-2 h-4 w-4" />Nuevo gasto</Button> : null}
          <input ref={cameraInputRef} onChange={handleCameraChange} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" />
        </div>
      </section>

      {user?.role === "user" ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Tu cuenta aún no tiene un rol del proyecto asignado. Después de iniciar sesión, el Administrador puede asignarte como Socio 1 (Ing. Angomas), Socio 2 (Ing. Johan), Participante o Contador.</div> : null}

      {canCreate ? <div className="flex flex-col gap-3 rounded-xl border border-[#eadfce] bg-[#fffdf9] px-4 py-3 text-sm text-[#5a4b37] sm:flex-row sm:items-center sm:justify-between"><span><strong>Nombre de gasto:</strong> los registros se identifican con tu nombre de cuenta o el nombre personalizado que indiques.</span><Button onClick={renameMyExpenseIdentity} disabled={setExpenseName.isPending} variant="outline" size="sm" className="shrink-0 border-[#d7c5ac] bg-white text-[#62471e]"><UserRoundPen className="mr-2 h-3.5 w-3.5" />Cambiar mi nombre</Button></div> : null}

      <Card className="overflow-hidden border-[#e7e0d5] bg-white shadow-sm">
        <CardHeader className="flex-row items-center justify-between border-b border-[#eee8de] pb-4"><div><CardTitle className="text-lg text-[#253142]">Cuadrícula de gastos</CardTitle><p className="mt-1 text-xs font-normal text-slate-500">Usa los selectores de color para personalizar tu vista. Los estilos se guardan solo para tu usuario.</p></div><span className="rounded-full bg-[#f5f1ea] px-3 py-1 text-xs font-medium text-slate-600">{rows.length + quickRows.length} filas</span></CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? <div className="grid h-64 place-items-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando gastos…</div> : null}
          {!listQuery.isLoading && rows.length === 0 && quickRows.length === 0 ? <EmptyExpenses canCreate={canCreate} onCreate={() => setDialog({})} /> : null}
          {(rows.length > 0 || quickRows.length > 0) ? <div className="overflow-x-auto"><table className="w-full min-w-[1550px] border-separate border-spacing-0 text-left text-sm"><thead className="text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{gridColumns.map(([key, label]) => <th key={key} className="border-b border-r border-[#e6dfd3] px-3 py-3 last:border-r-0" style={{ backgroundColor: resolveGridColor(gridStyles, "column", key, "#f8f7f3") }}><div className="flex items-center justify-between gap-2"><span>{label}</span><label title={`Color de la columna ${label}`} className="inline-flex cursor-pointer items-center text-[#9b7135]"><Palette className="h-3.5 w-3.5" /><input aria-label={`Color de la columna ${label}`} type="color" value={resolveGridColor(gridStyles, "column", key, "#f8f7f3")} onChange={event => saveGridColor("column", key, event.target.value)} className="sr-only" /></label></div></th>)}</tr></thead><tbody>{rows.map(expense => <GridExpenseRow key={expense.id} expense={expense} categories={categories} members={members} userId={user?.id} userRole={user?.role} isPrivileged={isPrivileged} values={editingRows[expense.id]} rowColor={resolveGridColor(gridStyles, "row", String(expense.id), "#ffffff")} isSaving={updateExpense.isPending} isReviewing={reviewMutation.isPending} onEdit={() => setEditingRows(current => ({ ...current, [expense.id]: toFormValues(expense) }))} onCancel={() => setEditingRows(current => { const next = { ...current }; delete next[expense.id]; return next; })} onChange={patch => setEditingRows(current => ({ ...current, [expense.id]: { ...(current[expense.id] ?? toFormValues(expense)), ...patch } }))} onSave={() => saveInlineEdit(expense)} onOpenDialog={() => setDialog({ expense })} onReview={handleReview} onColor={color => saveGridColor("row", String(expense.id), color)} />)}{quickRows.map(row => <QuickGridRow key={row.key} row={row} categories={categories} members={members} userRole={user?.role} isPrivileged={isPrivileged} isSaving={createExpense.isPending} onChange={patch => setQuickRows(current => current.map(currentRow => currentRow.key === row.key ? { ...currentRow, values: { ...currentRow.values, ...patch } } : currentRow))} onSave={() => saveQuickRow(row.key, row.values)} onRemove={() => setQuickRows(current => removeGridRow(current, row.key))} />)}</tbody></table></div> : null}
        </CardContent>
      </Card>

      {dialog ? <ExpenseDialog key={dialog.expense?.id ?? dialog.initialFile?.name ?? "new"} onClose={() => setDialog(null)} month={month} userRole={user?.role} isPrivileged={isPrivileged} categories={categories} members={members} existing={dialog.expense} initialFile={dialog.initialFile} onCompleted={completedMonth => { setMonth(completedMonth); invalidateFinancialQueries(utilities); }} /> : null}
    </div>
  );
}

function GridExpenseRow({ expense, categories, members, userId, userRole, isPrivileged, values, rowColor, isSaving, isReviewing, onEdit, onCancel, onChange, onSave, onOpenDialog, onReview, onColor }: { expense: ExpenseRow; categories: Category[]; members: ProjectMember[]; userId?: number; userRole?: string; isPrivileged: boolean; values?: FormValues; rowColor?: string; isSaving: boolean; isReviewing: boolean; onEdit: () => void; onCancel: () => void; onChange: (patch: Partial<FormValues>) => void; onSave: () => void; onOpenDialog: () => void; onReview: (id: number, decision: "approved" | "rejected") => void; onColor: (color: string) => void }) {
  const utilities = trpc.useUtils();
  const voidExpense = trpc.expenses.void.useMutation({ onSuccess: () => invalidateFinancialQueries(utilities) });
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const canEdit = isPrivileged || expense.createdByUserId === userId || expense.chargedToUserId === userId;
  const canVoid = expense.status !== "voided" && (isPrivileged || (canEdit && ["draft", "submitted", "rejected"].includes(expense.status)));
  const editing = Boolean(values);
  const cellStyle = { backgroundColor: rowColor || undefined };
  const submitVoid = async () => {
    if (voidReason.trim().length < 3) {
      toast.error("Indica un motivo de al menos 3 caracteres.");
      return;
    }
    try {
      await voidExpense.mutateAsync({ expenseId: expense.id, reason: voidReason.trim() });
      setVoidDialogOpen(false);
      setVoidReason("");
      toast.success("Gasto anulado. Su factura y auditoría se conservan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible anular el gasto.");
    }
  };
  return <><tr className="align-top hover:[&>td]:brightness-[0.985]">{editing && values ? <EditableCells values={values} categories={categories} members={members} userRole={userRole} isPrivileged={isPrivileged} onChange={onChange} /> : <><Cell style={cellStyle} className="whitespace-nowrap text-slate-600">{formatDate(expense.incurredOn)}</Cell><Cell style={cellStyle} className="min-w-[260px]"><p className="font-medium text-[#253142]">{expense.description}</p><p className="mt-1 text-xs text-slate-500">Registrado por {expense.createdBy.name || "Usuario"}</p></Cell><Cell style={cellStyle}><span className="inline-flex items-center gap-2 text-slate-700"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: expense.category.color }} />{expense.category.label}</span></Cell><Cell style={cellStyle} className="text-slate-600">{EXPENSE_TYPE_LABELS[expense.expenseType]}</Cell><Cell style={cellStyle} className="text-slate-600">{expense.expenseType === "global_shared" ? "Proyecto / Compartido" : expense.chargedTo?.name || "Sin asignar"}</Cell><Cell style={cellStyle} className="font-semibold text-[#253142]">{formatCurrency(expense.amount)}</Cell><Cell style={cellStyle}><InvoiceLinks invoices={expense.invoices} /></Cell><Cell style={cellStyle}><StatusPill status={expense.status} />{expense.approval?.comments ? <p className="mt-1 max-w-[180px] text-xs leading-4 text-slate-500">{expense.approval.comments}</p> : null}</Cell><Cell style={cellStyle}><div className="flex flex-wrap items-center gap-2">{canEdit ? <Button onClick={onEdit} size="sm" variant="outline" className="h-8 border-[#cfdae7] bg-white text-[#35506e]"><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button> : null}{canVoid ? <Button onClick={() => setVoidDialogOpen(true)} disabled={voidExpense.isPending} size="sm" variant="outline" className="h-8 border-red-200 text-red-700 hover:bg-red-50"><Trash2 className="mr-1 h-3.5 w-3.5" />Anular</Button> : null}{isPrivileged && expense.status === "submitted" ? <><Button onClick={() => onReview(expense.id, "approved")} disabled={isReviewing} size="sm" className="h-8 bg-[#21845d] text-white hover:bg-[#176a49]"><Check className="mr-1 h-3.5 w-3.5" />Aprobar</Button><Button onClick={() => onReview(expense.id, "rejected")} disabled={isReviewing} size="sm" variant="outline" className="h-8 border-red-200 text-red-700 hover:bg-red-50"><X className="mr-1 h-3.5 w-3.5" />Rechazar</Button></> : null}<label title="Color de esta fila" className="inline-flex cursor-pointer items-center text-[#9b7135]"><Palette className="h-4 w-4" /><input aria-label={`Color del gasto ${expense.id}`} type="color" value={rowColor || "#ffffff"} onChange={event => onColor(event.target.value)} className="sr-only" /></label></div></Cell></>}</tr><Dialog open={voidDialogOpen} onOpenChange={open => { setVoidDialogOpen(open); if (!open) setVoidReason(""); }}><DialogContent className="border-[#e7e0d5] bg-white sm:max-w-lg"><DialogHeader><DialogTitle className="text-[#253142]">Anular gasto</DialogTitle><DialogDescription className="leading-6 text-slate-600">El gasto dejará de participar en los totales operativos. La factura y el registro de auditoría se conservarán para revisión.</DialogDescription></DialogHeader><div className="grid gap-2"><label htmlFor={`void-reason-${expense.id}`} className="text-sm font-medium text-[#253142]">Motivo de anulación</label><textarea id={`void-reason-${expense.id}`} value={voidReason} onChange={event => setVoidReason(event.target.value)} placeholder="Describe el motivo de la anulación" className="min-h-24 w-full rounded-lg border border-[#d9d0c3] p-3 text-sm text-[#253142] outline-none focus:border-[#d89637] focus:ring-2 focus:ring-[#f2d7ad]/60" autoFocus /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setVoidDialogOpen(false)}>Cancelar</Button><Button type="button" onClick={() => void submitVoid()} disabled={voidExpense.isPending || voidReason.trim().length < 3} className="bg-red-700 text-white hover:bg-red-800">{voidExpense.isPending ? "Anulando…" : "Confirmar anulación"}</Button></DialogFooter></DialogContent></Dialog></>;
}

function QuickGridRow({ row, categories, members, userRole, isPrivileged, isSaving, onChange, onSave, onRemove }: { row: { key: string; values: FormValues }; categories: Category[]; members: ProjectMember[]; userRole?: string; isPrivileged: boolean; isSaving: boolean; onChange: (patch: Partial<FormValues>) => void; onSave: () => void; onRemove: () => void }) {
  return <tr className="align-top [&>td]:bg-[#fffcf4]"><EditableCells values={row.values} categories={categories} members={members} userRole={userRole} isPrivileged={isPrivileged} onChange={onChange} /><Cell><span className="text-xs text-amber-700">Guarda para adjuntar una factura.</span></Cell><Cell><StatusPill status="draft" /></Cell><Cell><div className="flex gap-2"><Button onClick={onSave} disabled={isSaving} size="sm" className="h-8 bg-[#253142] text-white hover:bg-[#18212d]"><Save className="mr-1 h-3.5 w-3.5" />Guardar</Button><Button onClick={onRemove} disabled={isSaving} size="sm" variant="outline" className="h-8 border-red-200 text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button></div></Cell></tr>;
}

function EditableCells({ values, categories, members, userRole, isPrivileged, onChange }: { values: FormValues; categories: Category[]; members: ProjectMember[]; userRole?: string; isPrivileged: boolean; onChange: (patch: Partial<FormValues>) => void }) {
  const responsibleMembers = members.filter(member => member.role === (values.expenseType === "participant" ? "participante" : values.expenseType));
  return <><Cell><input value={values.incurredOn} onChange={event => onChange({ incurredOn: event.target.value, reportingMonth: event.target.value.slice(0, 7) || values.reportingMonth })} type="date" className="grid-input min-w-[135px]" /></Cell><Cell><input value={values.description} onChange={event => onChange({ description: event.target.value })} placeholder="Descripción" className="grid-input min-w-[250px]" /></Cell><Cell><select value={values.categoryId} onChange={event => onChange({ categoryId: event.target.value })} className="grid-input min-w-[150px]"><option value="">Categoría…</option>{categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Cell><Cell><select value={values.expenseType} onChange={event => onChange({ expenseType: event.target.value as ExpenseType, chargedToUserId: "" })} className="grid-input min-w-[160px]">{getVisibleTypes(userRole).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Cell><Cell>{values.expenseType === "global_shared" ? <span className="text-xs text-slate-500">Proyecto / Compartido</span> : isPrivileged ? <select value={values.chargedToUserId} onChange={event => onChange({ chargedToUserId: event.target.value })} className="grid-input min-w-[170px]"><option value="">Responsable…</option>{responsibleMembers.map(member => <option key={member.id} value={member.id}>{memberDisplayName(member)}</option>)}</select> : <span className="text-xs text-slate-500">Tu cuenta</span>}</Cell><Cell><input value={values.amount} onChange={event => onChange({ amount: event.target.value })} type="number" min="0.01" step="0.01" placeholder="0.00" className="grid-input min-w-[110px] text-right" /></Cell></>;
}

function Cell({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <td className={`border-b border-r border-[#e6dfd3] px-3 py-3 last:border-r-0 ${className}`} style={style}>{children}</td>;
}

function InvoiceLinks({ invoices }: { invoices: ExpenseRow["invoices"] }) {
  return <div className="flex min-w-[150px] flex-wrap gap-2">{invoices.map(invoice => <a key={invoice.id} href={invoice.fileUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-[150px] items-center gap-1 rounded-md bg-[#f3f0ea] px-2 py-1 text-xs text-[#4d5b6d] hover:bg-[#e8e1d6]"><Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{invoice.originalName}</span></a>)}{invoices.length === 0 ? <span className="text-xs text-amber-700">Sin evidencia</span> : null}</div>;
}

function EmptyExpenses({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return <div className="grid min-h-72 place-items-center px-5 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f4efe7] text-[#b98232]"><FileText className="h-5 w-5" /></span><h3 className="mt-4 font-semibold text-[#253142]">No hay gastos en este período</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Inserta una fila como en una hoja de cálculo o registra un gasto tomando una foto de la factura.</p>{canCreate ? <Button onClick={onCreate} className="mt-4 bg-[#253142] text-white hover:bg-[#18212d]">Registrar el primer gasto</Button> : null}</div></div>;
}

function StatusPill({ status }: { status: keyof typeof EXPENSE_STATUS_LABELS }) {
  const styles = { draft: "bg-slate-100 text-slate-600", submitted: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800", voided: "bg-stone-200 text-stone-700" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{EXPENSE_STATUS_LABELS[status]}</span>;
}

function ExpenseDialog({ onClose, month, userRole, isPrivileged, categories, members, existing, initialFile, onCompleted }: { onClose: () => void; month: string; userRole?: string; isPrivileged: boolean; categories: Category[]; members: ProjectMember[]; existing?: ExpenseRow; initialFile?: File; onCompleted: (month: string) => void }) {
  const createExpense = trpc.expenses.create.useMutation();
  const updateExpense = trpc.expenses.update.useMutation();
  const uploadInvoice = trpc.expenses.uploadInvoice.useMutation();
  const submitExpense = trpc.expenses.submit.useMutation();
  const extractInvoice = trpc.expenses.extractInvoice.useMutation();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const processedInitialFile = useRef(false);
  const [values, setValues] = useState<FormValues>(existing ? toFormValues(existing) : makeBlankRow(month, userRole));
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [aiNote, setAiNote] = useState<{ confidence: number; notes: string; model: string } | null>(null);
  const isSaving = createExpense.isPending || updateExpense.isPending || uploadInvoice.isPending || submitExpense.isPending;
  const responsibleMembers = useMemo(() => members.filter(member => member.role === (values.expenseType === "participant" ? "participante" : values.expenseType)), [members, values.expenseType]);

  const applyInvoiceExtraction = async (nextFile: File) => {
    if (!allowedMimes.includes(nextFile.type as (typeof allowedMimes)[number])) { toast.error("Adjunta un JPG, PNG o PDF de hasta 10 MB."); return; }
    if (nextFile.size > 10 * 1024 * 1024) { toast.error("La factura no puede superar 10 MB."); return; }
    setFile(nextFile);
    try {
      const base64 = await readFileAsBase64(nextFile);
      const result = await extractInvoice.mutateAsync({ fileName: nextFile.name, mimeType: nextFile.type as (typeof allowedMimes)[number], fileSize: nextFile.size, base64 });
      const category = categories.find(item => item.label === result.categoryLabel);
      setValues(current => ({
        ...current,
        description: result.description || current.description,
        amount: result.amount > 0 ? String(result.amount) : current.amount,
        incurredOn: result.incurredOn || current.incurredOn,
        reportingMonth: result.reportingMonth || current.reportingMonth,
        categoryId: category ? String(category.id) : current.categoryId,
      }));
      setAiNote({ confidence: result.confidence, notes: result.notes, model: result.model });
      toast.success("Factura leída. Revisa los campos sugeridos antes de guardar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible leer la factura con IA.");
    }
  };

  useEffect(() => {
    if (initialFile && categories.length > 0 && !processedInitialFile.current) {
      processedInitialFile.current = true;
      void applyInvoiceExtraction(initialFile);
    }
  }, [categories.length, initialFile]);

  const saveExpense = async (event: FormEvent) => {
    event.preventDefault();
    const payload = validateValues(values, isPrivileged);
    if (!payload) return;
    try {
      let expenseId = existing?.id;
      if (existing) {
        await updateExpense.mutateAsync({ expenseId: existing.id, ...payload });
      } else {
        const created = await createExpense.mutateAsync({ ...payload, aiAssisted: Boolean(aiNote) });
        expenseId = created.id;
      }
      if (!expenseId) throw new Error("No se pudo identificar el gasto.");
      if (file && (!existing || !existing.invoices.some(invoice => invoice.originalName === file.name))) {
        const base64 = await readFileAsBase64(file);
        await uploadInvoice.mutateAsync({ expenseId, fileName: file.name, mimeType: file.type as (typeof allowedMimes)[number], fileSize: file.size, base64 });
        await submitExpense.mutateAsync({ expenseId });
        toast.success("Gasto guardado y enviado al Contador para revisión.");
      } else {
        toast.success(existing ? "Gasto actualizado como borrador para nueva revisión." : "Gasto guardado como borrador. Adjunta una factura para enviarlo a revisión.");
      }
      onCompleted(payload.reportingMonth);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar el gasto.");
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) void applyInvoiceExtraction(nextFile);
    event.target.value = "";
  };

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1f2937]/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"><form onSubmit={saveExpense} className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[1.75rem] bg-white p-6 shadow-2xl sm:rounded-[1.75rem] sm:p-7"><div className="flex items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9b7135]">{existing ? "Edición de registro" : "Nuevo registro"}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#253142]">{existing ? "Editar gasto" : "Registrar gasto"}</h2><p className="mt-2 text-sm text-slate-600">Una factura puede rellenar los campos automáticamente. Confirma siempre la información antes de guardar.</p></div><Button type="button" onClick={onClose} variant="ghost" className="h-9 w-9 rounded-full p-0"><X className="h-4 w-4" /></Button></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Descripción" className="sm:col-span-2"><textarea value={values.description} onChange={event => setValues(current => ({ ...current, description: event.target.value }))} required rows={3} maxLength={1200} placeholder="Ej. Compra de cemento y varillas" className="w-full resize-y rounded-lg border border-[#ddd5c9] bg-white px-3 py-2.5 text-sm text-[#253142] outline-none focus:border-[#d89637]" /></Field><Field label="Monto (DOP)"><input value={values.amount} onChange={event => setValues(current => ({ ...current, amount: event.target.value }))} required type="number" min="0.01" step="0.01" placeholder="0.00" className="form-input" /></Field><Field label="Fecha"><input value={values.incurredOn} onChange={event => setValues(current => ({ ...current, incurredOn: event.target.value, reportingMonth: event.target.value.slice(0, 7) || current.reportingMonth }))} required type="date" className="form-input" /></Field><Field label="Mes del gasto"><input value={values.reportingMonth} onChange={event => setValues(current => ({ ...current, reportingMonth: event.target.value }))} required type="month" className="form-input" /></Field><Field label="Categoría"><select value={values.categoryId} onChange={event => setValues(current => ({ ...current, categoryId: event.target.value }))} required className="form-input"><option value="">Seleccionar categoría</option>{categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field><Field label="Tipo de gasto"><select value={values.expenseType} onChange={event => setValues(current => ({ ...current, expenseType: event.target.value as ExpenseType, chargedToUserId: "" }))} className="form-input">{getVisibleTypes(userRole).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>{isPrivileged && values.expenseType !== "global_shared" ? <Field label="Persona responsable"><select value={values.chargedToUserId} onChange={event => setValues(current => ({ ...current, chargedToUserId: event.target.value }))} required className="form-input"><option value="">Seleccionar persona</option>{responsibleMembers.map(member => <option key={member.id} value={member.id}>{memberDisplayName(member)} — {USER_ROLE_LABELS[member.role]}</option>)}</select>{responsibleMembers.length === 0 ? <span className="text-xs font-normal text-amber-700">Todavía no hay un usuario con ese rol. Asigna el rol desde Equipo y roles.</span> : null}</Field> : null}<Field label="Factura o recibo" className="sm:col-span-2"><input ref={inputRef} onChange={handleFileChange} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" /><input ref={cameraRef} onChange={handleFileChange} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" /><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => inputRef.current?.click()} className="invoice-button"><Paperclip className="h-4 w-4" /><span><strong>{file ? file.name : "Adjuntar archivo"}</strong><small>JPG, PNG o PDF · máx. 10 MB</small></span></button><button type="button" onClick={() => cameraRef.current?.click()} className="invoice-button"><Camera className="h-4 w-4" /><span><strong>Tomar foto de factura</strong><small>Abre la cámara en móvil</small></span></button></div>{extractInvoice.isPending ? <p className="mt-2 inline-flex items-center gap-2 text-xs text-[#9b7135]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Leyendo la factura con IA…</p> : null}{aiNote ? <div className="mt-3 rounded-lg border border-[#d8dff8] bg-[#f4f6ff] p-3 text-xs text-[#415585]"><p className="flex items-center gap-1.5 font-semibold"><Sparkles className="h-3.5 w-3.5" />Datos sugeridos por {aiNote.model} · confianza {Math.round(aiNote.confidence * 100)}%</p>{aiNote.notes ? <p className="mt-1 leading-5">{aiNote.notes}</p> : null}</div> : null}</Field></div><div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button><Button type="submit" disabled={isSaving || extractInvoice.isPending} className="bg-[#253142] text-white hover:bg-[#18212d]">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{file ? "Guardar y enviar" : existing ? "Guardar edición" : "Guardar borrador"}</Button></div></form></div>;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-[#354255] ${className}`}><span>{label}</span>{children}</label>;
}

function validateValues(values: FormValues, isPrivileged: boolean) {
  const amount = Number(values.amount);
  if (!values.description.trim() || !values.categoryId || !values.reportingMonth || !values.incurredOn || !Number.isFinite(amount) || amount <= 0) {
    toast.error("Completa descripción, monto, fecha, mes y categoría.");
    return null;
  }
  if (isPrivileged && values.expenseType !== "global_shared" && !values.chargedToUserId) {
    toast.error("Selecciona la persona responsable del gasto.");
    return null;
  }
  return { description: values.description.trim(), amount, incurredOn: values.incurredOn, categoryId: Number(values.categoryId), expenseType: values.expenseType, chargedToUserId: values.expenseType === "global_shared" ? null : isPrivileged ? Number(values.chargedToUserId) : undefined, reportingMonth: values.reportingMonth };
}

function invalidateFinancialQueries(utilities: ReturnType<typeof trpc.useUtils>) {
  void utilities.expenses.list.invalidate();
  void utilities.dashboard.analytics.invalidate();
  void utilities.reports.monthly.invalidate();
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No fue posible leer el archivo."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") { reject(new Error("Formato de archivo inválido.")); return; }
      resolve(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
  });
}
