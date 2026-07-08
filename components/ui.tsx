import { ButtonHTMLAttributes, HTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function TucupyMark({ className = "h-6 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 270 404" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M135.85 62.59c-8.766 0-26.791-17.86-26.791-26.546 0-8.205 18.025-26.065 26.791-26.065 8.766 0 26.792 17.86 26.792 26.065 0 8.685-18.026 26.546-26.792 26.546Z"
        fill="#FEBE01"
      />
      <path
        d="m79.373 13.548 49.036 206.068h13.192l49.027-206.068C192.473 5.781 199.472.297 207.527.297h61.951l-100.93 403.407H93.431l31.539-119.315H71.066L.531.297h61.951c8.056 0 15.046 5.484 16.9 13.251h-.01Z"
        fill="#FEBE01"
      />
    </svg>
  );
}

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
    tone === "good" ? "text-success" : tone === "bad" ? "text-danger" : tone === "warn" ? "text-amber" : "text-ink";
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
    primary: "bg-primary text-[#0f0f0f] hover:bg-primary-dark",
    ghost: "border border-border bg-transparent text-ink hover:bg-surface2",
    danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "good" | "bad" | "warn" }) {
  const toneClass =
    tone === "good"
      ? "bg-success/10 text-success border-success/30"
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
