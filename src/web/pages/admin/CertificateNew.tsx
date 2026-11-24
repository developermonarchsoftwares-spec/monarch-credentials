import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Plus, UserRound } from "lucide-react";
import { api, ApiError, qs } from "@/lib/api";
import { useDebounced, useFetch } from "@/lib/hooks";
import { Alert, Card, Modal } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PageHeader } from "./Layout";
import { StudentForm } from "./student-form";

type Type = { id: number; code: string; name: string; template: string; issuerId: number; issuerName: string; writable: boolean };
type Student = { id: number; fullName: string; email: string | null };

export const CertificateNew = () => {
  const nav = useNavigate();
  const types = useFetch<{ types: Type[] }>("/api/admin/certificates/types").data?.types.filter((t) => t.writable) ?? [];
  const issuers = [...new Map(types.map((t) => [t.issuerId, t.issuerName])).entries()];
  const [issuerId, setIssuerId] = useState<number | "">("");
  const [typeId, setTypeId] = useState<number | "">("");
  const [student, setStudent] = useState<Student | null>(null);
  const [programme, setProgramme] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStart] = useState("");
  const [completionDate, setEnd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (issuers.length === 1 && issuerId === "") setIssuerId(issuers[0]![0]); }, [issuers.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const issuerTypes = types.filter((t) => t.issuerId === issuerId);
  const chosen = types.find((t) => t.id === typeId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!student || !typeId) { setError("Choose a certificate type and a student."); return; }
    setBusy(true); setError("");
    try {
      const r = await api<{ certificateId: string }>("/api/admin/certificates", {
        method: "POST",
        body: { studentId: student.id, typeId, programme, title: title || undefined, description: description || null, startDate: startDate || null, completionDate: completionDate || null },
      });
      nav(`/admin/certificates/${r.certificateId}`);
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not create certificate"); setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Issue certificate" description="Creates a draft. Review it, then publish to make it publicly verifiable." />
      <form onSubmit={submit} className="max-w-3xl space-y-6" noValidate>
        {error && <Alert>{error}</Alert>}
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">1. Credential</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Issuing brand" htmlFor="issuer">
              <Select id="issuer" value={issuerId} onChange={(e) => { setIssuerId(e.target.value ? Number(e.target.value) : ""); setTypeId(""); }}>
                <option value="">Select issuer…</option>{issuers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </Select>
            </Field>
            <Field label="Certificate type" htmlFor="type">
              <Select id="type" value={typeId} disabled={!issuerId} onChange={(e) => setTypeId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select type…</option>{issuerTypes.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
              </Select>
            </Field>
          </div>
        </Card>
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">2. Student</h2>
          <StudentPicker value={student} onChange={setStudent} />
        </Card>
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">3. Programme details</h2>
          <Field label={chosen?.template.includes("intern") ? "Internship programme" : "Course / programme"} htmlFor="prog"><Input id="prog" value={programme} onChange={(e) => setProgramme(e.target.value)} maxLength={160} placeholder="e.g. Full Stack Web Development" required /></Field>
          <Field label="Certificate title" htmlFor="title" hint={`Leave blank to use “${chosen?.name ?? "the certificate type name"}”.`}><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="sd"><Input id="sd" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Completion date" htmlFor="cd"><Input id="cd" type="date" value={completionDate} min={startDate || undefined} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          <Field label="Public description (optional)" htmlFor="desc" hint="Shown on the public verification page. Do not include personal details."><Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} /></Field>
        </Card>
        <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Create draft</Button><Button asChild variant="outline"><Link to="/admin/certificates">Cancel</Link></Button></div>
      </form>
    </>
  );
};

const StudentPicker = ({ value, onChange }: { value: Student | null; onChange: (s: Student | null) => void }) => {
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [creating, setCreating] = useState(false);
  const { data } = useFetch<{ items: Student[] }>(dq.length >= 2 ? `/api/admin/students${qs({ q: dq, pageSize: 8 })}` : null);
  if (value) return (
    <div className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2">
      <span className="flex items-center gap-2 text-sm"><UserRound className="size-4 text-muted" /><strong>{value.fullName}</strong><span className="text-muted">{value.email}</span></span>
      <button type="button" className="text-sm text-royal hover:underline" onClick={() => onChange(null)}>Change</button>
    </div>
  );
  return (
    <>
      <Input aria-label="Search students" placeholder="Search existing students by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      {dq.length >= 2 && (
        <ul className="divide-y divide-line rounded-md border border-line text-sm">
          {data?.items.map((s) => <li key={s.id}><button type="button" onClick={() => onChange(s)} className="flex w-full justify-between px-3 py-2 text-left hover:bg-surface"><span className="font-medium">{s.fullName}</span><span className="text-muted">{s.email}</span></button></li>)}
          {data && data.items.length === 0 && <li className="px-3 py-2 text-muted">No matching students.</li>}
        </ul>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}><Plus />New student</Button>
      <Modal open={creating} onOpenChange={setCreating} title="New student" description="Existing records are checked for duplicates.">
        <StudentForm initial={{ fullName: q }} onCancel={() => setCreating(false)} onSaved={async (id) => { const r = await api<{ student: { id: number; fullName: string; email: string | null } }>(`/api/admin/students/${id}`); onChange(r.student); setCreating(false); }} />
      </Modal>
    </>
  );
};
