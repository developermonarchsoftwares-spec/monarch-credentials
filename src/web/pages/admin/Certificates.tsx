import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Search } from "lucide-react";
import { useFetch, useDebounced } from "@/lib/hooks";
import { qs } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Alert, Card, Pagination, StatusBadge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { PageHeader } from "./Layout";

type Item = { certificateId: string; status: string; title: string; programme: string; issueDate: string | null; createdAt: string; issuer: { id: number; name: string }; student: { id: number; fullName: string } };
type Types = { types: { id: number; name: string; issuerId: number; issuerName: string }[] };

export const Certificates = () => {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounced(q);
  const status = sp.get("status") ?? "", issuerId = sp.get("issuerId") ?? "", sort = sp.get("sort") ?? "created_at", dir = sp.get("dir") ?? "desc";
  const page = Number(sp.get("page") ?? 1);
  const { data, error, loading } = useFetch<{ items: Item[]; total: number; pageSize: number }>(`/api/admin/certificates${qs({ q: dq, status, issuerId, sort, dir, page })}`);
  const types = useFetch<Types>("/api/admin/certificates/types").data;
  const issuers = [...new Map((types?.types ?? []).map((t) => [t.issuerId, t.issuerName])).entries()];

  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k !== "page") n.delete("page"); setSp(n, { replace: true }); };
  const sortBy = (col: string) => { const n = new URLSearchParams(sp); n.set("sort", col); n.set("dir", sort === col && dir === "desc" ? "asc" : "desc"); n.delete("page"); setSp(n, { replace: true }); };
  const Th = ({ col, children }: { col: string; children: string }) => (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted" aria-sort={sort === col ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => sortBy(col)} className="inline-flex items-center gap-1 hover:text-navy">{children}{sort === col && (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}</button>
    </th>
  );

  return (
    <>
      <PageHeader title="Certificates" actions={user?.canWrite && <Button asChild><Link to="/admin/certificates/new"><Plus />Issue certificate</Link></Button>} />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-3">
          <div className="relative min-w-52 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input aria-label="Search certificates" className="pl-9" placeholder="Search ID, student or programme" value={q} onChange={(e) => { setQ(e.target.value); set("page", ""); }} /></div>
          <Select aria-label="Status" className="w-36" value={status} onChange={(e) => set("status", e.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="valid">Valid</option><option value="revoked">Revoked</option></Select>
          {issuers.length > 1 && <Select aria-label="Issuer" className="w-48" value={issuerId} onChange={(e) => set("issuerId", e.target.value)}><option value="">All issuers</option>{issuers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>}
        </div>
        {error && <div className="p-4"><Alert>{error}</Alert></div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line bg-surface/60"><tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">Certificate ID</th>
              <Th col="student">Student</Th><th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">Credential</th>
              <Th col="status">Status</Th><Th col="issue_date">Issued</Th><Th col="created_at">Created</Th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {data?.items.map((c) => (
                <tr key={c.certificateId} className="hover:bg-surface/50">
                  <td className="px-4 py-3"><Link className="tabular font-medium text-royal hover:underline" to={`/admin/certificates/${c.certificateId}`}>{c.certificateId}</Link></td>
                  <td className="px-4 py-3">{c.student.fullName}</td>
                  <td className="px-4 py-3"><div className="font-medium text-navy">{c.title}</div><div className="text-xs text-muted">{c.issuer.name} · {c.programme}</div></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-muted">{formatDate(c.issueDate)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">{dq || status || issuerId ? "No certificates match these filters." : "No certificates yet. Issue the first one to get started."}</td></tr>}
              {loading && !data && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
        {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={(p) => set("page", String(p))} />}
      </Card>
    </>
  );
};
