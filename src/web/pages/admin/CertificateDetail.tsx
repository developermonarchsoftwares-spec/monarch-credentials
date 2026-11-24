import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Copy, Download, Eye, Pencil, Send, Trash2, Ban, Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { formatDate, formatDateTime } from "@/lib/utils";
import { QrCode } from "@/components/brand";
import { Alert, Card, Modal, StatusBadge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "./Layout";
import { useAuth } from "@/lib/auth";

type Detail = {
  certificate: { certificateId: string; status: string; title: string; programme: string; description: string | null; startDate: string | null; completionDate: string | null; issueDate: string | null; revokedAt: string | null; revokedReason: string | null; issuer: { id: number; name: string }; type: { name: string }; student: { id: number; fullName: string } };
  history: { action: string; by: string | null; details: Record<string, string> | null; at: string }[];
  verifications: { count: number; lastAt: string | null };
};
const ACTIONS: Record<string, string> = { "certificate.create": "Draft created", "certificate.update": "Draft edited", "certificate.publish": "Published", "certificate.revoke": "Revoked", "certificate.delete_draft": "Draft deleted" };

export const CertificateDetail = () => {
  const { certificateId = "" } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, error, reload } = useFetch<Detail>(`/api/admin/certificates/${certificateId}`);
  const [modal, setModal] = useState<"" | "revoke" | "edit" | "publish" | "delete">("");
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ tone: "bad" | "ok"; text: string } | null>(null);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <p className="text-sm text-muted">Loading…</p>;
  const c = data.certificate;
  const writable = user?.writableIssuerIds === "all" || (Array.isArray(user?.writableIssuerIds) && user.writableIssuerIds.includes(c.issuer.id));
  const url = `${location.origin}/certificate/${c.certificateId}`;

  return (
    <>
      <PageHeader title={c.title} description={`${c.student.fullName} · ${c.issuer.name}`} actions={<StatusBadge status={c.status} />} />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <Card className="p-5">
          <dl className="divide-y divide-line text-sm">
            {([["Certificate ID", c.certificateId], ["Student", c.student.fullName], ["Type", c.type.name], ["Programme", c.programme], ["Start date", formatDate(c.startDate)], ["Completion date", formatDate(c.completionDate)], ["Issue date", formatDate(c.issueDate)], ...(c.description ? [["Description", c.description]] : []), ...(c.status === "revoked" ? [["Revoked", `${formatDate(c.revokedAt)} — ${c.revokedReason}`]] : [])] as [string, string][]).map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[160px_1fr]"><dt className="text-muted">{k}</dt><dd className="font-medium text-navy">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
            {writable && c.status === "draft" && <><Button onClick={() => setModal("publish")}><Send />Publish</Button><Button variant="outline" onClick={() => setModal("edit")}><Pencil />Edit draft</Button><Button variant="outline" onClick={() => setModal("delete")}><Trash2 />Delete draft</Button></>}
            {writable && c.status === "valid" && <Button variant="danger" onClick={() => setModal("revoke")}><Ban />Revoke</Button>}
            <Button asChild variant="outline"><a href={`/api/admin/certificates/${c.certificateId}/pdf`} target="_blank" rel="noopener"><Eye />{c.status === "draft" ? "Preview PDF" : "View PDF"}</a></Button>
            {c.status !== "draft" && <Button asChild variant="outline"><Link to={`/certificate/${c.certificateId}`} target="_blank">Public page</Link></Button>}
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5 text-center">
            {c.status === "draft" ? <p className="text-sm text-muted">The QR code is available once the credential is published.</p> : <>
              <div className="flex justify-center"><QrCode value={url} size={160} /></div>
              <Button variant="outline" size="sm" className="mt-3" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy link"}</Button>
            </>}
          </Card>
          <Card className="p-5 text-sm"><p className="text-muted">Public verifications</p><p className="tabular text-2xl font-bold text-navy">{data.verifications.count}</p><p className="text-xs text-muted">{data.verifications.lastAt ? `Last: ${formatDateTime(data.verifications.lastAt)}` : "Not verified yet"}</p></Card>
        </div>
      </div>
      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold">History</h2>
        <ol className="mt-3 space-y-3 border-l border-line pl-4">
          {data.history.map((h, i) => <li key={i} className="relative text-sm"><span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-royal" /><span className="font-medium text-navy">{ACTIONS[h.action] ?? h.action}</span> <span className="text-muted">by {h.by ?? "system"} · {formatDateTime(h.at)}</span>{h.details?.reason && <p className="text-muted">Reason: {h.details.reason}</p>}</li>)}
        </ol>
      </Card>

      <ActionModals modal={modal} close={() => setModal("")} cert={c} done={(text, gone) => { setMsg({ tone: "ok", text }); setModal(""); if (gone) nav("/admin/certificates"); else reload(); }} />
    </>
  );
};

const ActionModals = ({ modal, close, cert, done }: { modal: string; close: () => void; cert: Detail["certificate"]; done: (text: string, gone?: boolean) => void }) => {
  const [reason, setReason] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [f, setF] = useState({ title: cert.title, programme: cert.programme, description: cert.description ?? "", startDate: cert.startDate ?? "", completionDate: cert.completionDate ?? "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string, gone = false) => {
    setBusy(true); setErr("");
    try { await fn(); done(ok, gone); } catch (e) { setErr(e instanceof ApiError ? e.message : "Action failed"); } finally { setBusy(false); }
  };
  const base = `/api/admin/certificates/${cert.certificateId}`;
  return (
    <>
      <Modal open={modal === "publish"} onOpenChange={(o) => !o && close()} title="Publish credential" description="Once published, this credential is publicly verifiable and can no longer be edited or deleted.">
        {err && <Alert>{err}</Alert>}
        <div className="mt-3"><Field label="Issue date" htmlFor="idt"><Input id="idt" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field></div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={busy} onClick={() => run(() => api(`${base}/publish`, { method: "POST", body: { issueDate } }), "Credential published.")}>Publish</Button></div>
      </Modal>
      <Modal open={modal === "revoke"} onOpenChange={(o) => !o && close()} title="Revoke credential" description="The public page will immediately show this credential as revoked and the PDF will no longer be downloadable. This cannot be undone.">
        {err && <Alert>{err}</Alert>}
        <div className="mt-3"><Field label="Reason (recorded in the audit log and shown publicly)" htmlFor="rr"><Textarea id="rr" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field></div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancel</Button><Button variant="danger" disabled={busy || reason.trim().length < 5} onClick={() => run(() => api(`${base}/revoke`, { method: "POST", body: { reason } }), "Credential revoked.")}>Revoke credential</Button></div>
      </Modal>
      <Modal open={modal === "delete"} onOpenChange={(o) => !o && close()} title="Delete draft?" description="This removes the draft. Published credentials can only be revoked, never deleted.">
        {err && <Alert>{err}</Alert>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={close}>Keep draft</Button><Button variant="danger" disabled={busy} onClick={() => run(() => api(base, { method: "DELETE" }), "Draft deleted.", true)}>Delete draft</Button></div>
      </Modal>
      <Modal open={modal === "edit"} onOpenChange={(o) => !o && close()} title="Edit draft">
        {err && <Alert>{err}</Alert>}
        <div className="mt-3 space-y-3">
          <Field label="Title" htmlFor="et"><Input id="et" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Programme" htmlFor="ep"><Input id="ep" value={f.programme} onChange={(e) => setF({ ...f, programme: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" htmlFor="es"><Input id="es" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
            <Field label="Completion" htmlFor="ec"><Input id="ec" type="date" value={f.completionDate} onChange={(e) => setF({ ...f, completionDate: e.target.value })} /></Field>
          </div>
          <Field label="Description" htmlFor="ed"><Textarea id="ed" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={busy} onClick={() => run(() => api(base, { method: "PUT", body: { title: f.title, programme: f.programme, description: f.description || null, startDate: f.startDate || null, completionDate: f.completionDate || null } }), "Draft updated.")}>Save changes</Button></div>
      </Modal>
    </>
  );
};
