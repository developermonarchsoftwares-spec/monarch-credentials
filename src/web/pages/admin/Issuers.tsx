import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { IssuerLogo } from "@/components/brand";
import { Alert, Badge, Card } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader } from "./Layout";

type I = { slug: string; name: string; tagline: string; description: string; logoPath: string | null; website: string | null; contactEmail: string | null; contactPhone: string | null; address: string | null; signatoryName: string | null; signatoryDesignation: string | null; writable: boolean };

export const Issuers = () => {
  const { data, error, reload } = useFetch<{ issuers: I[] }>("/api/admin/issuers");
  return (
    <>
      <PageHeader title="Issuers" description="Public profile and authorised signatory for each Monarch organisation." />
      {error && <Alert>{error}</Alert>}
      <div className="space-y-5">{data?.issuers.map((i) => <IssuerCard key={i.slug} issuer={i} onSaved={reload} />)}</div>
    </>
  );
};

const IssuerCard = ({ issuer, onSaved }: { issuer: I; onSaved: () => void }) => {
  const [v, setV] = useState({ tagline: issuer.tagline, description: issuer.description, website: issuer.website ?? "", contactEmail: issuer.contactEmail ?? "", contactPhone: issuer.contactPhone ?? "", address: issuer.address ?? "", signatoryName: issuer.signatoryName ?? "", signatoryDesignation: issuer.signatoryDesignation ?? "" });
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const ro = !issuer.writable;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { await api(`/api/admin/issuers/${issuer.slug}`, { method: "PUT", body: v }); setMsg({ tone: "ok", text: "Saved." }); onSaved(); }
    catch (err) { setMsg({ tone: "bad", text: err instanceof ApiError ? err.message : "Could not save" }); } finally { setBusy(false); }
  };
  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3"><IssuerLogo path={issuer.logoPath} name={issuer.name} /><h2 className="text-lg font-semibold">{issuer.name}</h2>{ro && <Badge>Read-only</Badge>}</div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {!issuer.signatoryName && <Alert tone="warn">Set an authorised signatory before publishing certificates for this issuer. It is printed on every PDF.</Alert>}
        <Field label="Tagline" htmlFor={`${issuer.slug}-t`}><Input id={`${issuer.slug}-t`} disabled={ro} value={v.tagline} onChange={set("tagline")} maxLength={120} /></Field>
        <Field label="Description" htmlFor={`${issuer.slug}-d`}><Textarea id={`${issuer.slug}-d`} disabled={ro} value={v.description} onChange={set("description")} maxLength={800} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Official website (https)" htmlFor={`${issuer.slug}-w`}><Input id={`${issuer.slug}-w`} disabled={ro} value={v.website} onChange={set("website")} placeholder="https://" /></Field>
          <Field label="Contact email" htmlFor={`${issuer.slug}-e`}><Input id={`${issuer.slug}-e`} type="email" disabled={ro} value={v.contactEmail} onChange={set("contactEmail")} /></Field>
          <Field label="Contact phone" htmlFor={`${issuer.slug}-p`}><Input id={`${issuer.slug}-p`} disabled={ro} value={v.contactPhone} onChange={set("contactPhone")} /></Field>
          <Field label="Address" htmlFor={`${issuer.slug}-a`}><Input id={`${issuer.slug}-a`} disabled={ro} value={v.address} onChange={set("address")} /></Field>
          <Field label="Authorised signatory name" htmlFor={`${issuer.slug}-sn`} hint="Printed on certificates. Use a real, authorised person."><Input id={`${issuer.slug}-sn`} disabled={ro} value={v.signatoryName} onChange={set("signatoryName")} maxLength={80} /></Field>
          <Field label="Signatory designation" htmlFor={`${issuer.slug}-sd`}><Input id={`${issuer.slug}-sd`} disabled={ro} value={v.signatoryDesignation} onChange={set("signatoryDesignation")} maxLength={80} /></Field>
        </div>
        {!ro && <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Save issuer</Button>}
      </form>
    </Card>
  );
};
