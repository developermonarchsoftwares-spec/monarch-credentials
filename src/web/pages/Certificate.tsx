import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Copy, Download, SearchX, ShieldCheck, XCircle, Check } from "lucide-react";
import type { PublicCertificate } from "@shared/types";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { linkedInAddUrl, linkedInShareUrl } from "@/lib/linkedin";
import { IssuerLogo, LinkedInIcon, QrCode } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/misc";

type State = { kind: "loading" } | { kind: "ok"; cert: PublicCertificate } | { kind: "error"; status: number; message: string };

export const Certificate = () => {
  const { certificateId = "" } = useParams();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setState({ kind: "loading" });
    api<{ certificate: PublicCertificate }>(`/api/public/certificates/${encodeURIComponent(certificateId)}`)
      .then((r) => { setState({ kind: "ok", cert: r.certificate }); document.title = `${r.certificate.title} · ${r.certificate.studentName} · Monarch Credentials`; })
      .catch((e: unknown) => setState({ kind: "error", status: e instanceof ApiError ? e.status : 0, message: e instanceof ApiError ? e.message : "Could not reach the verification service." }));
    return () => { document.title = "Monarch Credentials"; };
  }, [certificateId]);

  if (state.kind === "loading") return <div className="mx-auto max-w-3xl space-y-4 px-4 py-14 sm:px-6"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;

  if (state.kind === "error") {
    const notFound = state.status === 404;
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-warn-bg text-warn">{notFound ? <SearchX className="size-7" /> : <AlertTriangle className="size-7" />}</div>
        <h1 className="mt-6 text-2xl font-bold">{notFound ? "Credential not found" : state.status === 429 ? "Too many requests" : "Unable to verify"}</h1>
        <p className="mt-3 text-muted">{state.message}</p>
        {notFound && <p className="mt-2 text-sm text-muted">A missing record means this ID was never issued by Monarch, or was mistyped. Check the ID against the certificate and try again.</p>}
        <Button asChild className="mt-8"><Link to="/verify">Search again</Link></Button>
      </div>
    );
  }

  const c = state.cert;
  const revoked = c.status === "revoked";
  const copy = async () => {
    try { await navigator.clipboard.writeText(c.verifyUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("Copy this link", c.verifyUrl); }
  };
  const rows: [string, string][] = [
    ["Certificate title", c.title],
    ["Programme", c.programme],
    ["Issued by", c.issuerName],
    ["Issue date", formatDate(c.issueDate)],
    ...(c.startDate ? [["Start date", formatDate(c.startDate)] as [string, string]] : []),
    ...(c.completionDate ? [["Completion date", formatDate(c.completionDate)] as [string, string]] : []),
    ["Credential ID", c.certificateId],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className={`rise flex items-start gap-4 rounded-lg border p-5 ${revoked ? "border-bad/25 bg-bad-bg" : "border-ok/25 bg-ok-bg"}`} role="status">
        {revoked ? <XCircle className="mt-0.5 size-6 shrink-0 text-bad" /> : <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ok" />}
        <div>
          <p className={`text-lg font-semibold ${revoked ? "text-bad" : "text-ok"}`}>{revoked ? "This credential has been revoked" : "Verified. This credential is valid."}</p>
          <p className="mt-0.5 text-sm text-ink/75">
            {revoked ? `Revoked on ${formatDate(c.revokedAt)}. It should no longer be relied upon.${c.revokedReason ? ` Reason: ${c.revokedReason}` : ""}` : `Confirmed against the live Monarch credential register for ${c.issuerName}.`}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_220px]">
        <section className="rounded-lg border border-line bg-white p-6 shadow-soft sm:p-8">
          <div className="flex items-center gap-3">
            <IssuerLogo path={c.issuerLogoPath} name={c.issuerName} />
            <div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Issued by</p><p className="font-semibold text-navy">{c.issuerName}</p></div>
            <div className="ml-auto"><StatusBadge status={c.status} /></div>
          </div>
          <p className="mt-8 text-sm text-muted">This credential was awarded to</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{c.studentName}</h1>
          {c.description && <p className="mt-4 text-sm leading-relaxed text-ink/80">{c.description}</p>}
          <dl className="mt-8 divide-y divide-line border-t border-line">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-3 sm:grid-cols-[170px_1fr]">
                <dt className="text-sm text-muted">{k}</dt>
                <dd className={`text-sm font-medium text-navy ${k === "Credential ID" ? "tabular tracking-wide" : ""}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border border-line bg-white p-5 text-center shadow-soft">
            <div className="flex justify-center"><QrCode value={c.verifyUrl} size={168} /></div>
            <p className="mt-3 text-xs leading-relaxed text-muted">Scan to open this verification page.</p>
          </div>
          <div className="space-y-2">
            {!revoked && <Button asChild className="w-full"><a href={`/api/public/certificates/${c.certificateId}/pdf`}><Download />Download PDF</a></Button>}
            <Button variant="outline" className="w-full" onClick={copy}>{copied ? <Check className="text-ok" /> : <Copy />}{copied ? "Link copied" : "Copy verification link"}</Button>
            {!revoked && <Button asChild variant="outline" className="w-full"><a href={linkedInShareUrl(c)} target="_blank" rel="noopener noreferrer"><LinkedInIcon className="size-4" />Share on LinkedIn</a></Button>}
          </div>
        </aside>
      </div>

      {!revoked && (
        <section className="mt-6 rounded-lg border border-line bg-surface p-6">
          <h2 className="text-base font-semibold">Add this credential to LinkedIn</h2>
          <p className="mt-1 text-sm text-muted">LinkedIn does not verify Monarch credentials automatically. Adding one creates an entry you fill in yourself, so it links back to this page for anyone who wants to check it.</p>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-ink/85">
            <li>Select <strong>Add to LinkedIn profile</strong> below. The details are pre-filled for you.</li>
            <li>If the form is empty, open your profile, choose <strong>Add profile section → Licenses &amp; certifications</strong>, and enter the details below.</li>
            <li>Check the details, then save.</li>
          </ol>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {[["Name", c.title], ["Issuing organisation", c.issuerName], ["Issue date", formatDate(c.issueDate)], ["Credential ID", c.certificateId], ["Credential URL", c.verifyUrl]].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="break-all font-medium text-navy">{v}</dd></div>
            ))}
          </dl>
          <Button asChild className="mt-5" variant="navy"><a href={linkedInAddUrl(c)} target="_blank" rel="noopener noreferrer"><LinkedInIcon className="size-4" />Add to LinkedIn profile</a></Button>
        </section>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />Only the information needed to authenticate this credential is shown. This is a Monarch credential and is not a university degree or a government-recognised qualification.</p>
    </div>
  );
};
