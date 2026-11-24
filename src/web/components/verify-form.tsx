import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/form";

const ID_RE = /^[A-Z]{3}-\d{4}-[0-9A-HJKMNP-TV-Z]{8}$/;

export const VerifyIdForm = ({ autoFocus }: { autoFocus?: boolean }) => {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = value.trim().toUpperCase();
    if (!ID_RE.test(id)) { setError("Enter an ID in the format MPS-2026-XXXXXXXX, as printed on the certificate."); return; }
    setError("");
    nav(`/certificate/${id}`);
  };
  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="cert-id" className="sr-only">Certificate ID</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input id="cert-id" autoFocus={autoFocus} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Certificate ID, e.g. MPS-2026-K7Q4M9XB" className="h-12 pl-9 font-medium tracking-wide" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-invalid={!!error} aria-describedby={error ? "id-err" : undefined} />
        </div>
        <Button type="submit" size="lg">Verify <ArrowRight /></Button>
      </div>
      {error && <p id="id-err" role="alert" className="mt-2 text-sm text-bad">{error}</p>}
    </form>
  );
};
