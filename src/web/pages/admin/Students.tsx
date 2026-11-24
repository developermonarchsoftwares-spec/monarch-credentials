import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api, ApiError, qs } from "@/lib/api";
import { useDebounced, useFetch } from "@/lib/hooks";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Alert, Card, Modal, Pagination, StatusBadge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { PageHeader } from "./Layout";
import { StudentForm } from "./student-form";

type S = { id: number; fullName: string; email: string | null; phone: string | null; notes: string | null; createdAt: string; certificateCount?: number };

export const Students = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounced(q);
  const page = Number(sp.get("page") ?? 1);
  const [creating, setCreating] = useState(false);
  const { data, error, loading } = useFetch<{ items: S[]; total: number; pageSize: number }>(`/api/admin/students${qs({ q: dq, page })}`);
  return (
    <>
      <PageHeader title="Students" actions={user?.canWrite && <Button onClick={() => setCreating(true)}><Plus />New student</Button>} />
      <Card>
        <div className="border-b border-line p-3"><div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input aria-label="Search students" className="pl-9" placeholder="Search by name or email" value={q} onChange={(e) => { setQ(e.target.value); setSp({}, { replace: true }); }} /></div></div>
        {error && <div className="p-4"><Alert>{error}</Alert></div>}
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-line bg-surface/60 text-left text-xs font-semibold text-muted"><tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Certificates</th><th className="px-4 py-2.5">Added</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data?.items.map((s) => <tr key={s.id} className="hover:bg-surface/50"><td className="px-4 py-3"><Link className="font-medium text-royal hover:underline" to={`/admin/students/${s.id}`}>{s.fullName}</Link></td><td className="px-4 py-3 text-muted">{s.email ?? "—"}</td><td className="tabular px-4 py-3">{s.certificateCount}</td><td className="px-4 py-3 text-muted">{formatDate(s.createdAt)}</td></tr>)}
            {!loading && data?.items.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted">{dq ? "No students match your search." : "No students yet."}</td></tr>}
          </tbody>
        </table></div>
        {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={(p) => setSp({ page: String(p) })} />}
      </Card>
      <Modal open={creating} onOpenChange={setCreating} title="New student" description="Existing records are checked for duplicates.">
        <StudentForm onCancel={() => setCreating(false)} onSaved={(id) => nav(`/admin/students/${id}`)} />
      </Modal>
    </>
  );
};

export const StudentDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, error, reload } = useFetch<{ student: S; certificates: { certificateId: string; title: string; programme: string; status: string; issueDate: string | null; issuerName: string }[] }>(`/api/admin/students/${id}`);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <p className="text-sm text-muted">Loading…</p>;
  const s = data.student;
  return (
    <>
      <PageHeader title={s.fullName} description="Private record. Never shown publicly." actions={user?.canWrite && <div className="flex gap-2"><Button variant="outline" onClick={() => setEditing(true)}><Pencil />Edit</Button><Button variant="outline" onClick={async () => { if (!confirm("Remove this student record?")) return; try { await api(`/api/admin/students/${s.id}`, { method: "DELETE" }); nav("/admin/students"); } catch (e) { setErr(e instanceof ApiError ? e.message : "Failed"); } }}><Trash2 />Remove</Button></div>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      <Card className="mb-4 p-5"><dl className="grid gap-4 text-sm sm:grid-cols-3">{([["Email", s.email], ["Phone", s.phone], ["Notes", s.notes]] as const).map(([k, v]) => <div key={k}><dt className="text-muted">{k}</dt><dd className="font-medium text-navy">{v || "—"}</dd></div>)}</dl></Card>
      <Card>
        <div className="flex items-center justify-between border-b border-line p-4"><h2 className="font-semibold">Certificate history</h2>{user?.canWrite && <Button asChild size="sm"><Link to="/admin/certificates/new">Issue certificate</Link></Button>}</div>
        <ul className="divide-y divide-line">
          {data.certificates.map((c) => <li key={c.certificateId}><Link to={`/admin/certificates/${c.certificateId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface/50"><div><p className="text-sm font-medium text-navy">{c.title}</p><p className="text-xs text-muted">{c.issuerName} · {c.programme} · <span className="tabular">{c.certificateId}</span></p></div><StatusBadge status={c.status} /></Link></li>)}
          {data.certificates.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">No certificates issued to this student yet.</li>}
        </ul>
      </Card>
      <Modal open={editing} onOpenChange={setEditing} title="Edit student">
        <StudentForm studentId={s.id} initial={{ fullName: s.fullName, email: s.email ?? "", phone: s.phone ?? "", notes: s.notes ?? "" }} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />
      </Modal>
    </>
  );
};
