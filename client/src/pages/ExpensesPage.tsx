import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMonthValue, formatCurrency, formatDate } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { EXPENSE_STATUS_LABELS, EXPENSE_TYPE_LABELS } from "@shared/expenseConstants";
import { Check, FileText, Loader2, Paperclip, Plus, Send, X } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const allowedMimes = ["image/jpeg", "image/png", "application/pdf"];
const typeOptions = [
  { value: "socio_1", label: "Socio 1" },
  { value: "socio_2", label: "Socio 2" },
  { value: "global_shared", label: "Global/Compartido" },
] as const;

type ExpenseType = (typeof typeOptions)[number]["value"];

export default function ExpensesPage() {
  const [month, setMonth] = useState(currentMonthValue);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const utilities = trpc.useUtils();
  const listQuery = trpc.expenses.list.useQuery({ month });
  const reviewMutation = trpc.expenses.review.useMutation({
    onSuccess: () => utilities.expenses.list.invalidate(),
  });
  const isPrivileged = user?.role === "contador" || user?.role === "admin";
  const canCreate = user?.role === "socio_1" || user?.role === "socio_2" || user?.role === "admin";

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

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b7135]">Registro operativo</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#253142]">Gastos y evidencias</h1>
          <p className="mt-2 text-sm text-slate-600">Cada gasto conserva su respaldo, su socio responsable y su estado de revisión contable.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-medium text-slate-600">
            Período
            <input value={month} onChange={event => setMonth(event.target.value)} type="month" className="h-10 rounded-lg border border-[#ddd5c9] bg-white px-3 text-sm text-[#253142] outline-none focus:border-[#d89637]" />
          </label>
          {canCreate ? <Button onClick={() => setIsOpen(true)} className="h-10 bg-[#253142] text-white hover:bg-[#18212d]"><Plus className="mr-2 h-4 w-4" />Nuevo gasto</Button> : null}
        </div>
      </section>

      {user?.role === "user" ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Tu cuenta aún no tiene un rol del proyecto asignado. Solicita al Administrador que la asigne como Socio 1 (Ing. Angomas), Socio 2 (Ing. Johan) o Contador.</div> : null}

      <Card className="overflow-hidden border-[#e7e0d5] bg-white shadow-sm">
        <CardHeader className="flex-row items-center justify-between border-b border-[#eee8de] pb-4">
          <CardTitle className="text-lg text-[#253142]">Listado del período</CardTitle>
          <span className="rounded-full bg-[#f5f1ea] px-3 py-1 text-xs font-medium text-slate-600">{listQuery.data?.length ?? 0} registros</span>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? <div className="grid h-64 place-items-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando gastos…</div> : null}
          {!listQuery.isLoading && (listQuery.data?.length ?? 0) === 0 ? <EmptyExpenses canCreate={canCreate} onCreate={() => setIsOpen(true)} /> : null}
          {(listQuery.data?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-[#fbfaf8] text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Descripción</th><th className="px-5 py-3">Categoría</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Responsable</th><th className="px-5 py-3">Monto</th><th className="px-5 py-3">Evidencias</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Acción</th></tr>
                </thead>
                <tbody className="divide-y divide-[#eee8de]">
                  {listQuery.data?.map(expense => (
                    <tr key={expense.id} className="align-top hover:bg-[#fcfaf6]">
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(expense.incurredOn)}</td>
                      <td className="max-w-[260px] px-5 py-4"><p className="font-medium text-[#253142]">{expense.description}</p><p className="mt-1 text-xs text-slate-500">Registrado por {expense.createdBy.name || "Usuario"}</p></td>
                      <td className="px-5 py-4"><span className="inline-flex items-center gap-2 text-slate-700"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: expense.category.color }} />{expense.category.label}</span></td>
                      <td className="px-5 py-4 text-slate-600">{EXPENSE_TYPE_LABELS[expense.expenseType]}</td>
                      <td className="px-5 py-4 text-slate-600">{expense.expenseType === "global_shared" ? "Proyecto / Compartido" : expense.chargedToUserId === user?.id ? "Tú" : "Socio asignado"}</td>
                      <td className="px-5 py-4 font-semibold text-[#253142]">{formatCurrency(expense.amount)}</td>
                      <td className="px-5 py-4"><div className="flex flex-wrap gap-2">{expense.invoices.map(invoice => <a key={invoice.id} href={invoice.fileUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-[160px] items-center gap-1 rounded-md bg-[#f3f0ea] px-2 py-1 text-xs text-[#4d5b6d] hover:bg-[#e8e1d6]"><Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{invoice.originalName}</span></a>)}{expense.invoices.length === 0 ? <span className="text-xs text-amber-700">Sin evidencia</span> : null}</div></td>
                      <td className="px-5 py-4"><StatusPill status={expense.status} />{expense.approval?.comments ? <p className="mt-1 max-w-[180px] text-xs leading-4 text-slate-500">{expense.approval.comments}</p> : null}</td>
                      <td className="px-5 py-4">{isPrivileged && expense.status === "submitted" ? <div className="flex gap-2"><Button onClick={() => handleReview(expense.id, "approved")} disabled={reviewMutation.isPending} size="sm" className="h-8 bg-[#21845d] text-white hover:bg-[#176a49]"><Check className="mr-1 h-3.5 w-3.5" />Aprobar</Button><Button onClick={() => handleReview(expense.id, "rejected")} disabled={reviewMutation.isPending} size="sm" variant="outline" className="h-8 border-red-200 text-red-700 hover:bg-red-50"><X className="mr-1 h-3.5 w-3.5" />Rechazar</Button></div> : <span className="text-xs text-slate-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isOpen ? <ExpenseDialog onClose={() => setIsOpen(false)} month={month} defaultRole={user?.role} onCompleted={completedMonth => { setMonth(completedMonth); utilities.expenses.list.invalidate(); }} /> : null}
    </div>
  );
}

function EmptyExpenses({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return <div className="grid min-h-72 place-items-center px-5 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f4efe7] text-[#b98232]"><FileText className="h-5 w-5" /></span><h3 className="mt-4 font-semibold text-[#253142]">No hay gastos en este período</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Los registros aparecerán aquí con su categoría, evidencia, socio responsable y estado de aprobación.</p>{canCreate ? <Button onClick={onCreate} className="mt-4 bg-[#253142] text-white hover:bg-[#18212d]">Registrar el primer gasto</Button> : null}</div></div>;
}

function StatusPill({ status }: { status: keyof typeof EXPENSE_STATUS_LABELS }) {
  const styles = { draft: "bg-slate-100 text-slate-600", submitted: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{EXPENSE_STATUS_LABELS[status]}</span>;
}

function ExpenseDialog({ onClose, month, defaultRole, onCompleted }: { onClose: () => void; month: string; defaultRole?: string; onCompleted: (month: string) => void }) {
  const categories = trpc.categories.list.useQuery();
  const projectUsers = trpc.projectUsers.list.useQuery(undefined, { enabled: defaultRole === "admin" });
  const createExpense = trpc.expenses.create.useMutation();
  const uploadInvoice = trpc.expenses.uploadInvoice.useMutation();
  const submitExpense = trpc.expenses.submit.useMutation();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [incurredOn, setIncurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [reportingMonth, setReportingMonth] = useState(month);
  const [categoryId, setCategoryId] = useState("");
  const [expenseType, setExpenseType] = useState<ExpenseType>(defaultRole === "socio_2" ? "socio_2" : defaultRole === "socio_1" ? "socio_1" : "global_shared");
  const [chargedToUserId, setChargedToUserId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSaving = createExpense.isPending || uploadInvoice.isPending || submitExpense.isPending;
  const visibleTypes = useMemo(() => {
    if (defaultRole === "admin") return typeOptions;
    if (defaultRole === "socio_1") return typeOptions.filter(option => option.value !== "socio_2");
    if (defaultRole === "socio_2") return typeOptions.filter(option => option.value !== "socio_1");
    return [];
  }, [defaultRole]);
  const responsiblePartners = useMemo(
    () => projectUsers.data?.filter(member => member.role === expenseType) ?? [],
    [expenseType, projectUsers.data],
  );

  const saveExpense = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryId || !amount || !description.trim() || !reportingMonth) { toast.error("Completa los campos obligatorios, incluido el mes del gasto."); return; }
    if (defaultRole === "admin" && expenseType !== "global_shared" && !chargedToUserId) { toast.error("Selecciona el socio responsable del gasto."); return; }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { toast.error("Ingresa un monto válido."); return; }
    if (file && (!allowedMimes.includes(file.type) || file.size > 10 * 1024 * 1024)) { toast.error("Adjunta un JPG, PNG o PDF de hasta 10 MB."); return; }
    try {
      const created = await createExpense.mutateAsync({
        description: description.trim(),
        amount: numericAmount,
        incurredOn,
        categoryId: Number(categoryId),
        expenseType,
        chargedToUserId: expenseType === "global_shared" ? null : defaultRole === "admin" ? Number(chargedToUserId) : undefined,
        reportingMonth,
      });
      if (!created.id) throw new Error("No se pudo identificar el nuevo gasto.");
      if (file) {
        const base64 = await readFileAsBase64(file);
        await uploadInvoice.mutateAsync({ expenseId: created.id, fileName: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "application/pdf", fileSize: file.size, base64 });
        await submitExpense.mutateAsync({ expenseId: created.id });
        toast.success("Gasto enviado al Contador para revisión.");
      } else {
        toast.success("Gasto guardado como borrador. Adjunta una evidencia para enviarlo a revisión.");
      }
      onCompleted(reportingMonth);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar el gasto.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1f2937]/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <form onSubmit={saveExpense} className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[1.75rem] bg-white p-6 shadow-2xl sm:rounded-[1.75rem] sm:p-7">
        <div className="flex items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9b7135]">Nuevo registro</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#253142]">Registrar gasto</h2><p className="mt-2 text-sm text-slate-600">Con evidencia, el gasto se enviará automáticamente al Contador.</p></div><Button type="button" onClick={onClose} variant="ghost" className="h-9 w-9 rounded-full p-0"><X className="h-4 w-4" /></Button></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="Descripción" className="sm:col-span-2"><textarea value={description} onChange={event => setDescription(event.target.value)} required rows={3} maxLength={1200} placeholder="Ej. Compra de cemento y varillas" className="w-full resize-y rounded-lg border border-[#ddd5c9] bg-white px-3 py-2.5 text-sm text-[#253142] outline-none focus:border-[#d89637]" /></Field>
          <Field label="Monto (DOP)"><input value={amount} onChange={event => setAmount(event.target.value)} required type="number" min="0.01" step="0.01" placeholder="0.00" className="h-10 w-full rounded-lg border border-[#ddd5c9] bg-white px-3 text-sm text-[#253142] outline-none focus:border-[#d89637]" /></Field>
          <Field label="Fecha"><input value={incurredOn} onChange={event => setIncurredOn(event.target.value)} required type="date" className="h-10 w-full rounded-lg border border-[#ddd5c9] bg-white px-3 text-sm text-[#253142] outline-none focus:border-[#d89637]" /></Field>
          <Field label="Mes del gasto"><input value={reportingMonth} onChange={event => setReportingMonth(event.target.value)} required type="month" className="h-10 w-full rounded-lg border border-[#ddd5c9] bg-white px-3 text-sm text-[#253142] outline-none focus:border-[#d89637]" /></Field>
          <Field label="Categoría"><select value={categoryId} onChange={event => setCategoryId(event.target.value)} required className="h-10 w-full rounded-lg border border-[#ddd5c9] bg-white px-3 text-sm text-[#253142] outline-none focus:border-[#d89637]"><option value="">Seleccionar categoría</option>{categories.data?.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>
          <Field label="Tipo de gasto"><select value={expenseType} onChange={event => { setExpenseType(event.target.value as ExpenseType); setChargedToUserId(""); }} className="h-10 w-full rounded-lg border border-[#ddd5c9] bg-white px-3 text-sm text-[#253142] outline-none focus:border-[#d89637]">{visibleTypes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          {defaultRole === "admin" && expenseType !== "global_shared" ? <Field label="Socio responsable"><select value={chargedToUserId} onChange={event => setChargedToUserId(event.target.value)} required className="h-10 w-full rounded-lg border border-[#ddd5c9] bg-white px-3 text-sm text-[#253142] outline-none focus:border-[#d89637]"><option value="">Seleccionar socio</option>{responsiblePartners.map(member => <option key={member.id} value={member.id}>{member.name || `Usuario ${member.id}`}</option>)}</select>{projectUsers.isLoading ? <span className="text-xs font-normal text-slate-500">Cargando socios asignados…</span> : responsiblePartners.length === 0 ? <span className="text-xs font-normal text-amber-700">Aún no hay un usuario con este rol. Asigna el rol primero en Equipo y roles.</span> : null}</Field> : null}
          <Field label="Factura o recibo" className="sm:col-span-2"><input ref={inputRef} onChange={event => setFile(event.target.files?.[0] ?? null)} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" /><button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-dashed border-[#cfc4b3] bg-[#fcfaf6] px-4 text-left transition-colors hover:border-[#d89637] hover:bg-[#fffaf0]"><span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#b98232] shadow-sm"><Paperclip className="h-4 w-4" /></span><span><span className="block text-sm font-medium text-[#253142]">{file ? file.name : "Adjuntar JPG, PNG o PDF"}</span><span className="mt-1 block text-xs text-slate-500">Máximo 10 MB. Las evidencias se archivan en el mes seleccionado.</span></span></button></Field>
        </div>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button><Button type="submit" disabled={isSaving} className="bg-[#253142] text-white hover:bg-[#18212d]">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{file ? "Guardar y enviar" : "Guardar borrador"}</Button></div>
      </form>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-[#354255] ${className}`}><span>{label}</span>{children}</label>;
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
