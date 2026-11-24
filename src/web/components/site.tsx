import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLink } from "./brand";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/verify", label: "Verify" },
  { to: "/issuers/placements", label: "Monarch Placements" },
  { to: "/issuers/softwares", label: "Monarch Softwares" },
];

export const SiteLayout = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLink />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => cn("rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-navy", isActive && "text-navy")}>
                {n.label}
              </NavLink>
            ))}
            <Link to="/verify" className="ml-3 inline-flex h-9 items-center rounded-md bg-royal px-4 text-sm font-medium text-white hover:bg-royal-dark">Verify a certificate</Link>
          </nav>
          <button className="rounded-md p-2 text-navy md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-line bg-white px-4 py-3 md:hidden" aria-label="Mobile">
            {nav.map((n) => <Link key={n.to} to={n.to} className="block rounded-md px-3 py-3 text-sm font-medium text-navy">{n.label}</Link>)}
          </nav>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <SiteFooter />
    </div>
  );
};

const SiteFooter = () => (
  <footer className="bg-navy text-white">
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div>
        <BrandLink light />
        <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
          The public record of credentials issued by Monarch Placements and Monarch Softwares.
        </p>
      </div>
      <FooterCol title="Credentials" links={[["Verify a certificate", "/verify"], ["Monarch Placements", "/issuers/placements"], ["Monarch Softwares", "/issuers/softwares"]]} />
      <FooterCol title="Legal" links={[["Privacy notice", "/privacy"], ["Terms of use", "/terms"]]} />
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Monarch</h3>
        <ul className="mt-4 space-y-2.5 text-sm">
          <li><a className="text-white/80 hover:text-white" href="https://monarchplacements.in" rel="noopener">monarchplacements.in</a></li>
          <li><Link className="text-white/80 hover:text-white" to="/issuers/placements#contact">Placements contact</Link></li>
          <li><Link className="text-white/80 hover:text-white" to="/issuers/softwares#contact">Softwares contact</Link></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-white/10">
      <p className="mx-auto max-w-6xl px-4 py-5 text-xs leading-relaxed text-white/50 sm:px-6">
        Monarch credentials attest completion of programmes run by Monarch Placements and Monarch Softwares. They are not university degrees and do not imply accreditation or recognition by any government body or external authority.
      </p>
    </div>
  </footer>
);

const FooterCol = ({ title, links }: { title: string; links: [string, string][] }) => (
  <div>
    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">{title}</h3>
    <ul className="mt-4 space-y-2.5 text-sm">
      {links.map(([label, to]) => <li key={to}><Link className="text-white/80 hover:text-white" to={to}>{label}</Link></li>)}
    </ul>
  </div>
);
