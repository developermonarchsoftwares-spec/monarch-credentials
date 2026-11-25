import { cva, type VariantProps } from "class-variance-authority";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold", {
  variants: {
    tone: {
      // Monochrome: status is told apart by style as well as label.
      ok: "border border-ok bg-white text-ok",
      bad: "bg-bad text-white",
      warn: "border border-dashed border-warn bg-white text-warn",
      neutral: "bg-surface text-muted",
      blue: "bg-tint text-royal",
    },
  },
  defaultVariants: { tone: "neutral" },
});
export const Badge = ({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) => (
  <span className={cn(badgeVariants({ tone }), className)} {...p} />
);

export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { tone: "ok" | "bad" | "warn"; label: string }> = {
    valid: { tone: "ok", label: "Valid" },
    revoked: { tone: "bad", label: "Revoked" },
    draft: { tone: "warn", label: "Draft" },
  };
  const s = map[status] ?? { tone: "warn" as const, label: status };
  return (
    <Badge tone={s.tone}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </Badge>
  );
};

export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-lg border border-line bg-white", className)} {...p} />
);

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded-md bg-surface", className)} />;

export const Alert = ({ tone = "bad", children }: { tone?: "bad" | "ok" | "warn" | "blue"; children: ReactNode }) => {
  const t = { bad: "bg-bad-bg text-bad border-bad/20", ok: "bg-ok-bg text-ok border-ok/20", warn: "bg-warn-bg text-warn border-warn/20", blue: "bg-tint text-royal border-royal/20" }[tone];
  return <div role={tone === "bad" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", t)}>{children}</div>;
};

export const Modal = ({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40 backdrop-blur-[1px]" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-white p-6 shadow-lift focus:outline-none">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="text-lg font-semibold text-navy">{title}</Dialog.Title>
            {description && <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>}
          </div>
          <Dialog.Close className="rounded-md p-1 text-muted hover:bg-surface" aria-label="Close"><X className="size-4" /></Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export const Pagination = ({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
      <span className="tabular">{from}–{Math.min(page * pageSize, total)} of {total}</span>
      <div className="flex gap-2">
        <button className="rounded-md border border-line px-3 py-1 text-navy hover:bg-surface disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="rounded-md border border-line px-3 py-1 text-navy hover:bg-surface disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
};
