import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, ApiError, setCsrf } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { BrandLink } from "@/components/brand";
import { Alert } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

export const Login = () => {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/admin" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await api<{ csrfToken: string }>("/api/auth/login", { method: "POST", body: { email, password } });
      setCsrf(r.csrfToken);
      await refresh();
      nav("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <BrandLink />
      <form onSubmit={submit} className="mt-8 w-full max-w-sm space-y-4 rounded-lg border border-line bg-white p-7 shadow-soft">
        <div><h1 className="text-xl font-bold">Administrator sign in</h1><p className="mt-1 text-sm text-muted">Authorised Monarch staff only.</p></div>
        {error && <Alert>{error}</Alert>}
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" htmlFor="password"><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Sign in</Button>
      </form>
    </div>
  );
};
