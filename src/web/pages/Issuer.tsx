import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Globe, Mail, MapPin, Phone } from "lucide-react";
import type { PublicIssuer } from "@shared/types";
import { api } from "@/lib/api";
import { IssuerLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { NotFound } from "./NotFound";

type CredType = { slug: string; code: string; name: string; description: string };

const MEANING: Record<string, string> = {
  placements: "These credentials confirm that a learner completed a Monarch Placements programme or met its assessed standard. They describe what the learner did with Monarch Placements. They are not degrees and are not accredited by a university or government body.",
  softwares: "These credentials confirm that an intern completed a defined period of work at Monarch Softwares. They describe the programme and project the intern took part in. They are not degrees and are not accredited by a university or government body.",
};

export const Issuer = () => {
  const { slug = "" } = useParams();
  const [data, setData] = useState<{ issuers: PublicIssuer[]; credentialTypes: CredType[] } | null>(null);
  useEffect(() => { api("/api/public/issuers").then(setData).catch(() => setData({ issuers: [], credentialTypes: [] })); }, []);
  if (!data) return <div className="mx-auto max-w-4xl space-y-4 px-4 py-14"><Skeleton className="h-16" /><Skeleton className="h-64" /></div>;
  const issuer = data.issuers.find((i) => i.slug === slug);
  if (!issuer) return <NotFound />;
  const types = data.credentialTypes.filter((t) => t.slug === slug);
  const contact = [
    issuer.website && { icon: Globe, label: issuer.website.replace(/^https?:\/\//, ""), href: issuer.website },
    issuer.contactEmail && { icon: Mail, label: issuer.contactEmail, href: `mailto:${issuer.contactEmail}` },
    issuer.contactPhone && { icon: Phone, label: issuer.contactPhone, href: `tel:${issuer.contactPhone.replace(/\s/g, "")}` },
    issuer.address && { icon: MapPin, label: issuer.address },
  ].filter(Boolean) as { icon: typeof Globe; label: string; href?: string }[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
      <div>
        <IssuerLogo path={issuer.logoPath} name={issuer.name} className="h-14" />
        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">{issuer.name}</h1>
        <p className="text-muted">{issuer.tagline}</p>
      </div>
      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-ink/85">{issuer.description}</p>

      <h2 className="mt-14 text-xl font-semibold">Credentials issued</h2>
      <ul className="mt-5 divide-y divide-line rounded-lg border border-line">
        {types.map((t) => (
          <li key={t.code} className="flex items-start justify-between gap-4 p-5">
            <div><p className="font-semibold text-navy">{t.name}</p><p className="mt-1 text-sm text-muted">{t.description}</p></div>
            <span className="rounded-sm bg-surface px-2 py-1 text-xs font-semibold tracking-wider text-muted">{t.code}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-14 text-xl font-semibold">What these credentials represent</h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">{MEANING[slug]}</p>

      <section id="contact" className="mt-14 scroll-mt-24">
        <h2 className="text-xl font-semibold">Contact</h2>
        {contact.length ? (
          <ul className="mt-4 space-y-3 text-sm">
            {contact.map((c) => (
              <li key={c.label} className="flex items-center gap-3"><c.icon className="size-4 text-muted" />{c.href ? <a className="text-royal hover:underline" href={c.href} rel="noopener">{c.label}</a> : <span>{c.label}</span>}</li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted">Contact details for this organisation will be published here.</p>}
      </section>

      <Button asChild className="mt-12"><Link to="/verify">Verify a {issuer.name} certificate <ArrowRight /></Link></Button>
    </div>
  );
};
