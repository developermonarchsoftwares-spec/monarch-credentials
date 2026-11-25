import { renderSVG } from "uqr";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export const Mark = ({ className, tone = "navy" }: { className?: string; tone?: "navy" | "royal" }) => (
  <svg viewBox="0 0 64 64" className={cn("size-9", className)} aria-hidden>
    <rect width="64" height="64" fill={tone === "navy" ? "#0a0a0a" : "#000000"} />
    <path
      fill="#fff"
      d="M14.76 14 L32 29.28 L32 35.35 L19.81 25.12 L19.81 40.15 L27.14 34.08 L30.55 36.74 L14.76 50 Z M49.24 14 L32 29.28 L32 35.35 L44.19 25.12 L44.19 40.15 L36.86 34.08 L33.45 36.74 L49.24 50 Z"
    />
  </svg>
);

export const BrandLink = ({ light }: { light?: boolean }) => (
  <Link to="/" className="flex items-center gap-2.5">
    <Mark className="size-8" />
    <span className={cn("text-[15px] font-semibold tracking-tight", light ? "text-white" : "text-navy")}>
      Monarch <span className={light ? "text-white/70" : "text-muted"}>Credentials</span>
    </span>
  </Link>
);

export const IssuerLogo = ({ path, name, className }: { path: string | null; name: string; className?: string }) =>
  path ? <img src={path} alt={`${name} logo`} className={cn("size-10", className)} /> : <Mark className={className} />;

/** QR code generated in the browser from the public verification URL only. */
export const QrCode = ({ value, size = 144, label }: { value: string; size?: number; label?: string }) => {
  const svg = renderSVG(value, { ecc: "M", border: 1 });
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return <img src={src} width={size} height={size} alt={label ?? "QR code linking to this credential's verification page"} className="rounded-md border border-line bg-white p-1" />;
};

export const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
  </svg>
);
