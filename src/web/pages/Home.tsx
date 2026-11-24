import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, FileSearch, QrCode as QrIcon, ShieldCheck, Ban } from "lucide-react";
import { api } from "@/lib/api";
import type { PublicIssuer } from "@shared/types";
import { VerifyIdForm } from "@/components/verify-form";
import { IssuerLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";

type CredType = { slug: string; code: string; name: string; description: string };

export const Home = () => {
  const [data, setData] = useState<{ issuers: PublicIssuer[]; credentialTypes: CredType[] } | null>(null);
  useEffect(() => { api("/api/public/issuers").then(setData).catch(() => undefined); }, []);

  return (
    <>
      <section className="border-b border-line bg-[linear-gradient(180deg,#fff_0%,#f6f8fb_100%)]">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <p className="rise text-sm font-semibold uppercase tracking-[0.14em] text-royal">Monarch Credentials</p>
          <h1 className="rise mt-4 max-w-3xl text-4xl font-bold leading-[1.08] sm:text-6xl" style={{ animationDelay: "60ms" }}>
            Credentials That Build Career Confidence.
          </h1>
          <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-muted" style={{ animationDelay: "120ms" }}>
            Verify professional training, competency and internship credentials issued by Monarch.
          </p>
          <div className="rise mt-9 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "180ms" }}>
            <Button asChild size="lg"><Link to="/verify">Verify a Certificate <ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><a href="#issuers">Explore Monarch</a></Button>
          </div>
          <div className="rise mt-12 max-w-2xl rounded-lg border border-line bg-white p-5 shadow-soft" style={{ animationDelay: "240ms" }}>
            <p className="mb-3 text-sm font-medium text-navy">Have a certificate ID? Check it now.</p>
            <VerifyIdForm />
          </div>
        </div>
      </section>

      <section id="issuers" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-bold">Two issuers. One verification platform.</h2>
        <p className="mt-3 max-w-2xl text-muted">Each credential is issued by a specific Monarch organisation and verified on this site against its live record.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {(data?.issuers ?? []).map((i) => (
            <article key={i.slug} className="flex flex-col rounded-lg border border-line p-7 transition-shadow hover:shadow-soft">
              <div className="flex items-center gap-4">
                <IssuerLogo path={i.logoPath} name={i.name} className="size-12" />
                <div>
                  <h3 className="text-xl font-semibold">{i.name}</h3>
                  <p className="text-sm text-muted">{i.tagline}</p>
                </div>
              </div>
              <p className="mt-5 text-[15px] leading-relaxed text-ink/85">{i.description}</p>
              <ul className="mt-5 space-y-2 border-t border-line pt-5 text-sm">
                {(data?.credentialTypes ?? []).filter((t) => t.slug === i.slug).map((t) => (
                  <li key={t.code} className="flex items-start gap-2"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-royal" /><span>{t.name}</span></li>
                ))}
              </ul>
              <Link to={`/issuers/${i.slug}`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-royal hover:underline">About {i.name} <ArrowRight className="size-4" /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold">How verification works</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              { icon: FileSearch, t: "Find the credential ID", d: "Every certificate carries a unique ID and a QR code. Scan the code or type the ID into the verification page." },
              { icon: ShieldCheck, t: "We check the live record", d: "The ID is looked up directly in Monarch's credential register. Nothing is cached, so the result is always current." },
              { icon: BadgeCheck, t: "See the status", d: "You see whether the credential is valid or revoked, who it was issued to, by which Monarch organisation, and when." },
            ].map((s, n) => (
              <li key={s.t} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-md bg-white text-royal shadow-soft"><s.icon className="size-5" /></span>
                  <span className="text-xs font-semibold tracking-widest text-muted">STEP {n + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-bold">Why you can trust a Monarch credential record</h2>
            <p className="mt-4 text-muted leading-relaxed">Authenticity comes from the register, not from the PDF. A document alone can be edited; the live record cannot.</p>
          </div>
          <dl className="grid gap-6 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, t: "Unpredictable IDs", d: "IDs are generated with cryptographic randomness, so valid IDs cannot be guessed or enumerated." },
              { icon: QrIcon, t: "QR links to the record", d: "The QR code contains only the verification link. It never carries personal details." },
              { icon: Ban, t: "Revocation is instant", d: "If a credential is withdrawn, its page shows Revoked immediately and the PDF can no longer be downloaded." },
              { icon: FileSearch, t: "Minimal disclosure", d: "Only what is needed to authenticate is shown. Contact details and internal records are never public." },
            ].map((f) => (
              <div key={f.t}>
                <dt className="flex items-center gap-2 font-semibold text-navy"><f.icon className="size-4 text-royal" />{f.t}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted">{f.d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
};
