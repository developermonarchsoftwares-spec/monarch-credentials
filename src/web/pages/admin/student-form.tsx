import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";

export type StudentValues = { fullName: string; email: string; phone: string; notes: string };
type Dup = { id: number; fullName: string; email: string | null };

/** Create/edit form with duplicate protection: possible duplicates must be explicitly confirmed. */
export const StudentForm = ({ studentId, initial, onSaved, onCancel }: { studentId?: number; initial?: Partial<StudentValues>; onSaved: (id: number) => void; onCancel: () => void }) => {
  const [v, setV] = useState<StudentValues>({ fullName: "", email: "", phone: "", notes: "", ...initial });
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [dups, setDups] = useState<Dup[] | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof StudentValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  const submit = async (e: FormEvent | null, confirmDuplicate = false) => {
    e?.preventDefault();
    setBusy(true); setError(""); setFieldErr({});
    try {
      const body = { fullName: v.fullName, email: v.email || undefined, phone: v.phone || undefined, notes: v.notes || undefined, confirmDuplicate };
      const r = studentId ? await api(`/api/admin/students/${studentId}`, { method: "PUT", body }) : await api<{ id: number }>("/api/admin/students", { method: "POST", body });
      onSaved(studentId ?? r.id);
    } catch (err) {
      if (err instanceof ApiError && err.data?.duplicates) { setDups(err.data.duplicates); setError(err.message); if (err.data.code === "duplicate_email") setFieldErr({ email: "Already in use" }); }
      else if (err instanceof ApiError && err.data?.issues) setFieldErr(Object.fromEntries(err.data.issues.map((i: { path: string[]; message: string }) => [i.path[0], i.message])));
      else setError(err instanceof ApiError ? err.message : "Could not save student");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={(e) => submit(e)} className="space-y-4" noValidate>
      {error && <Alert tone={dups ? "warn" : "bad"}>{error}</Alert>}
      {dups && (
        <ul className="rounded-md border border-line text-sm">
          {dups.map((d) => <li key={d.id} className="border-b border-line px-3 py-2 last:border-0"><span className="font-medium">{d.fullName}</span> <span className="text-muted">{d.email ?? "no email"}</span></li>)}
        </ul>
      )}
      <Field label="Full name" htmlFor="sn" hint="As it should appear on the certificate." error={fieldErr.fullName}><Input id="sn" value={v.fullName} onChange={set("fullName")} maxLength={80} required /></Field>
      <Field label="Email (private)" htmlFor="se" error={fieldErr.email}><Input id="se" type="email" value={v.email} onChange={set("email")} /></Field>
      <Field label="Phone (private)" htmlFor="sp" error={fieldErr.phone}><Input id="sp" value={v.phone} onChange={set("phone")} /></Field>
      <Field label="Internal notes (private)" htmlFor="sno"><Textarea id="sno" value={v.notes} onChange={set("notes")} maxLength={1000} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        {dups && !fieldErr.email && <Button type="button" variant="navy" disabled={busy} onClick={() => submit(null, true)}>{studentId ? "Save anyway" : "Create anyway"}</Button>}
        {!dups && <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Save student</Button>}
      </div>
    </form>
  );
};
