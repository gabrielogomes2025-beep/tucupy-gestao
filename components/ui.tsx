import { ButtonHTMLAttributes, HTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-5 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Kpi({ label, value, sub, tone = "default" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "bad" | "warn" }) {
  const toneClass =
    tone === "good" ? "text-primary" : tone === "bad" ? "text-danger" : tone === "warn" ? "text-amber" : "text-ink";
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </Card>
  );
}

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-[#06120c] hover:bg-primary-dark",
    ghost: "border border-border bg-transparent text-ink hover:bg-surface2",
    danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "good" | "bad" | "warn" }) {
  const toneClass =
    tone === "good"
      ? "bg-primary/10 text-primary border-primary/30"
      : tone === "bad"
      ? "bg-danger/10 text-danger border-danger/30"
      : tone === "warn"
      ? "bg-amber/10 text-amber border-amber/30"
      : "bg-surface2 text-muted border-border";
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>;
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="mb-1 block text-xs font-medium text-muted" {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" {...props} />;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">{children}</div>;
}
