import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { ROLE_LABELS, type RoleKey } from "@shared/types";
import { api, ApiError } from "@/lib/api";
import { useFetch } from "@/lib/hooks";
import { formatDateTime } from "@/lib/utils";
import { Alert, Badge, Card, Modal } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { PageHeader } from "./Layout";

type U = { id: number; email: string; name: string; isActive: boolean; role: RoleKey | null; lastLoginAt: string | null };
const roles = Object.entries(ROLE_LABELS) as [RoleKey, string][];

export const Users = () => {
  const { data, error, reload } = useFetch<{ users: U[] }>("/api/admin/users");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<U | null>(null);
  const [msg, setMsg] = useState("");
  return (
    <>
      <PageHeader title="Users" description="Administrator accounts and roles." actions={<Button onClick={() => setOpen(true)}><Plus />New user</Button>} />
      {(error || msg) && <div className="mb-4"><Alert>{error || msg}</Alert></div>}
      <Card className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
        <thead className="border-b border-line bg-surface/60 text-left text-xs font-semibold text-muted"><tr><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Last sign-in</th><th /></tr></thead>
        <tbody className="divide-y divide-line">{data?.users.map((u) => (
          <tr key={u.id}><td className="px-4 py-3"><div className="font-medium text-navy">{u.name}</div><div className="text-xs text-muted">{u.email}</div></td><td className="px-4 py-3">{u.role ? ROLE_LABELS[u.role] : "—"}</td><td className="px-4 py-3"><Badge tone={u.isActive ? "ok" : "neutral"}>{u.isActive ? "Active" : "Disabled"}</Badge></td><td className="px-4 py-3 text-muted">{formatDateTime(u.lastLoginAt)}</td><td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEdit(u)}>Manage</Button></td></tr>
        ))}</tbody>
      </table></Card>
      <Modal open={open} onOpenChange={setOpen} title="New user" description="Passwords are hashed and cannot be viewed again."><CreateUser onDone={() => { setOpen(false); reload(); }} /></Modal>
      <Modal open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.name ?? ""} description={edit?.email}>{edit && <ManageUser key={edit.id} user={edit} onDone={(m) => { setEdit(null); setMsg(m); reload(); }} />}</Modal>
    </>
  );
};

const CreateUser = ({ onDone }: { onDone: () => void }) => {
  const [v, setV] = useState({ name: "", email: "", password: "", role: "viewer" as RoleKey });
  const [err, setErr] = useState("");
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr(""); try { await api("/api/admin/users", { method: "POST", body: v }); onDone(); } catch (x) { setErr(x instanceof ApiError ? x.message : "Failed"); } };
  return (
    <form onSubmit={submit} className="space-y-3">
      {err && <Alert>{err}</Alert>}
      <Field label="Name" htmlFor="un"><Input id="un" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required /></Field>
      <Field label="Email" htmlFor="ue"><Input id="ue" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required /></Field>
      <Field label="Temporary password" htmlFor="up" hint="At least 12 characters."><Input id="up" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} required minLength={12} /></Field>
      <Field label="Role" htmlFor="ur"><Select id="ur" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as RoleKey })}>{roles.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
      <div className="flex justify-end"><Button type="submit">Create user</Button></div>
    </form>
  );
};

const ManageUser = ({ user, onDone }: { user: U; onDone: (msg: string) => void }) => {
  const [role, setRole] = useState<RoleKey>(user.role ?? "viewer");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const save = async (body: object, ok: string) => { setErr(""); try { await api(`/api/admin/users/${user.id}`, { method: "PUT", body }); onDone(ok); } catch (x) { setErr(x instanceof ApiError ? x.message : "Failed"); } };
  return (
    <div className="space-y-4">
      {err && <Alert>{err}</Alert>}
      <div className="flex items-end gap-2"><div className="flex-1"><Field label="Role" htmlFor="mr"><Select id="mr" value={role} onChange={(e) => setRole(e.target.value as RoleKey)}>{roles.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field></div><Button onClick={() => save({ role }, "Role updated. The user must sign in again.")}>Update</Button></div>
      <div className="flex items-end gap-2"><div className="flex-1"><Field label="Reset password" htmlFor="mp" hint="Signs the user out everywhere."><Input id="mp" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field></div><Button variant="outline" disabled={password.length < 12} onClick={() => save({ password }, "Password reset.")}>Reset</Button></div>
      <Button variant={user.isActive ? "danger" : "primary"} onClick={() => save({ isActive: !user.isActive }, user.isActive ? "User disabled." : "User enabled.")}>{user.isActive ? "Disable account" : "Enable account"}</Button>
    </div>
  );
};
