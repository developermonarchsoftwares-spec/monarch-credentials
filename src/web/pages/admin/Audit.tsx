import { useState } from "react";
import { useFetch } from "@/lib/hooks";
import { formatDateTime } from "@/lib/utils";
import { Alert, Card, Pagination } from "@/components/ui/misc";
import { PageHeader } from "./Layout";

export const Audit = () => {
  const [page, setPage] = useState(1);
  const { data, error } = useFetch<{ items: { id: number; by: string | null; action: string; entityType: string | null; entityId: string | null; details: Record<string, unknown> | null; at: string }[]; total: number; pageSize: number }>(`/api/admin/audit?page=${page}`);
  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in and administrative change, newest first." />
      {error && <Alert>{error}</Alert>}
      <Card>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line bg-surface/60 text-left text-xs font-semibold text-muted"><tr><th className="px-4 py-2.5">When</th><th className="px-4 py-2.5">Who</th><th className="px-4 py-2.5">Action</th><th className="px-4 py-2.5">Target</th></tr></thead>
          <tbody className="divide-y divide-line">{data?.items.map((r) => (
            <tr key={r.id}><td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDateTime(r.at)}</td><td className="px-4 py-2.5">{r.by ?? "—"}</td><td className="px-4 py-2.5 font-medium text-navy">{r.action}</td><td className="px-4 py-2.5 text-muted"><span className="tabular">{r.entityType ? `${r.entityType}: ${r.entityId}` : "—"}</span>{r.details && <span className="block text-xs">{JSON.stringify(r.details)}</span>}</td></tr>
          ))}</tbody>
        </table></div>
        {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
};
