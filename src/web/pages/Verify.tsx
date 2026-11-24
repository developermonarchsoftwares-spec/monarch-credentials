import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import type { SearchResult } from "@shared/types";
import { api, ApiError } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { VerifyIdForm } from "@/components/verify-form";
import { Alert, StatusBadge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";

export const Verify = () => {
  const [mode, setMode] = useState<"id" | "name">("id");
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold sm:text-4xl">Verify a certificate</h1>
      <p className="mt-3 text-muted">Check that a Monarch credential is genuine and see its current status.</p>

      <div role="tablist" aria-label="Search method" className="mt-8 inline-flex rounded-md border border-line bg-surface p-1 text-sm">
        {(["id", "name"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded px-4 py-1.5 font-medium transition-colors", mode === m ? "bg-white text-navy shadow-soft" : "text-muted hover:text-navy")}>
            {m === "id" ? "Certificate ID" : "Learner name"}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-line bg-white p-5 shadow-soft sm:p-6">
        {mode === "id" ? (
          <>
            <VerifyIdForm autoFocus />
            <p className="mt-4 text-sm text-muted">The ID is printed on the certificate, beneath the QR code. Example format: <span className="font-medium text-navy">MPS-2026-XXXXXXXX</span>.</p>
          </>
        ) : (
          <NameSearch />
        )}
      </div>
    </div>
  );
};

const NameSearch = () => {
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("placements");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setResults(null);
    if (name.trim().split(/\s+/).length < 2) { setError("Enter the learner's full name (first and last name)."); return; }
    setBusy(true);
    try {
      setResults((await api<{ results: SearchResult[] }>("/api/public/search", { method: "POST", body: { name, issuer } })).results);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" hint="Exactly as printed on the certificate.">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={80} />
        </Field>
        <Field label="Issued by" htmlFor="issuer">
          <Select id="issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)}>
            <option value="placements">Monarch Placements</option>
            <option value="softwares">Monarch Softwares</option>
          </Select>
        </Field>
        <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Search</Button>
      </form>
      <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" />To protect privacy, name search needs an exact full name and shows masked results. Searching by certificate ID is more reliable.</p>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      {results && results.length === 0 && <div className="mt-4"><Alert tone="warn">No credential matches that name for this issuer. Check the spelling, or search by certificate ID.</Alert></div>}
      {results && results.length > 0 && (
        <ul className="mt-5 divide-y divide-line rounded-md border border-line">
          {results.map((r) => (
            <li key={r.certificateId}>
              <Link to={`/certificate/${r.certificateId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface">
                <div>
                  <p className="text-sm font-semibold text-navy">{r.title}</p>
                  <p className="text-xs text-muted">{r.maskedName} · {r.programme} · {formatDate(r.issueDate)}</p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};
