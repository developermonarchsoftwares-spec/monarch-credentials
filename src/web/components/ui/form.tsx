import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-[#9e9e9e] transition-colors focus:border-royal focus:outline-none focus:ring-2 focus:ring-royal/20 disabled:bg-surface disabled:text-muted";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(field, "h-10", className)} {...p} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(field, "min-h-20 py-2", className)} {...p} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cn(field, "h-10 pr-8", className)} {...p} />
));
Select.displayName = "Select";

export const Label = ({ className, ...p }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("mb-1.5 block text-sm font-medium text-navy", className)} {...p} />
);

export const Field = ({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) => (
  <div>
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
    {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
    {error && <p role="alert" className="mt-1 text-xs text-bad">{error}</p>}
  </div>
);
