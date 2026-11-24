import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useFetch } from "@/lib/hooks";
import { formatMonth, formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { BarChart } from "@/components/charts";
import { Alert, Card, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { PageHeader } from "./Layout";

type Stats = {
  totals: { certificates: number; valid: number; revoked: number; drafts: number; students: number; issuedThisMonth: number; verifications: number };
  issuedByMonth: { month: string; count: number }[];
  verificationsByDay: { date: string; count: number }[];
  byIssuer: { name: string; count: number }[];
};

export const Dashboard = () => {
  const { user } = useAuth();
  const { data, error, loading } = useFetch<Stats>("/api/admin/stats");
  const t = data?.totals;
  const cards: [string, number | undefined, string?][] = [
    ["Certificates issued", t ? t.valid + t.revoked : undefined, "Published, incl. revoked"],
    ["Valid", t?.valid],
    ["Revoked", t?.revoked],
    ["Drafts", t?.drafts],
    ["Students", t?.students],
    ["Issued this month", t?.issuedThisMonth],
  ];
  return (
    <>
      <PageHeader title="Dashboard" description="Live figures from the credential register." actions={user?.canWrite && <Button asChild><Link to="/admin/certificates/new"><Plus />Issue certificate</Link></Button>} />
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, v, hint]) => (
          <Card key={label} className="p-4">
            <p className="text-xs font-medium text-muted">{label}</p>
            {loading ? <Skeleton className="mt-2 h-8 w-12" /> : <p className="tabular mt-1 text-3xl font-bold text-navy">{v ?? 0}</p>}
            {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Certificates published</h2>
          <p className="mb-4 text-xs text-muted">Last 6 months</p>
          {data && <BarChart label="Certificates published per month" data={data.issuedByMonth.map((m) => ({ label: formatMonth(m.month), value: m.count }))} />}
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Verification activity</h2>
          <p className="mb-4 text-xs text-muted">Lookups over the last 14 days · {t?.verifications ?? 0} all time</p>
          {data && <BarChart label="Verification lookups per day" data={data.verificationsByDay.map((d) => ({ label: formatDate(d.date).split(" ")[0] ?? "", value: d.count }))} />}
        </Card>
      </div>
      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold">Published credentials by issuer</h2>
        {data && data.byIssuer.length === 0 && <p className="mt-3 text-sm text-muted">No credentials have been published yet.</p>}
        <ul className="mt-3 space-y-3">
          {data?.byIssuer.map((i) => {
            const total = Math.max(1, ...data.byIssuer.map((x) => x.count));
            return (
              <li key={i.name}>
                <div className="flex justify-between text-sm"><span>{i.name}</span><span className="tabular font-semibold text-navy">{i.count}</span></div>
                <div className="mt-1 h-2 rounded-full bg-surface"><div className="h-2 rounded-full bg-royal" style={{ width: `${(i.count / total) * 100}%` }} /></div>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
};
