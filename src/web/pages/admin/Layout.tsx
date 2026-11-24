import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Award, Building2, GraduationCap, History, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { BrandLink } from "@/components/brand";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export const AdminLayout = () => {
  const { user, loading, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  if (loading) return <div className="p-10 text-sm text-muted">Loading…</div>;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;

  const items = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/certificates", label: "Certificates", icon: Award },
    { to: "/admin/students", label: "Students", icon: GraduationCap },
    { to: "/admin/issuers", label: "Issuers", icon: Building2 },
    ...(user.isSuperAdmin ? [{ to: "/admin/users", label: "Users", icon: Users }, { to: "/admin/audit", label: "Audit log", icon: History }] : []),
  ];

  const sidebar = (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex h-16 items-center px-5"><BrandLink light /></div>
      <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Admin">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setOpen(false)} className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white", isActive && "bg-white/12 text-white")}>
            <i.icon className="size-4" />{i.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-white/55">{user.email}</p>
        <div className="mt-2 flex flex-wrap gap-1">{user.roles.map((r) => <Badge key={r.key} tone="blue">{r.name}</Badge>)}</div>
        <button onClick={async () => { await logout(); nav("/admin/login"); }} className="mt-3 flex items-center gap-2 text-sm text-white/70 hover:text-white"><LogOut className="size-4" />Sign out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-navy/50" onClick={() => setOpen(false)} /><div className="absolute inset-y-0 left-0 w-64">{sidebar}</div></div>}
      <div className="lg:pl-60">
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
          <button onClick={() => setOpen((o) => !o)} aria-label="Open menu" className="rounded-md p-2">{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
          <Link to="/" className="text-sm font-semibold text-navy">Monarch Credentials</Link>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><Outlet /></main>
      </div>
    </div>
  );
};

export const PageHeader = ({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div><h1 className="text-2xl font-bold">{title}</h1>{description && <p className="mt-1 text-sm text-muted">{description}</p>}</div>
    {actions}
  </div>
);
