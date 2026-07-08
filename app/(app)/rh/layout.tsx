import Link from "next/link";

const TABS = [
  { href: "/rh", label: "Colaboradores" },
  { href: "/rh/ferias", label: "Férias & Ausências" },
  { href: "/rh/folha", label: "Folha de Pagamento" },
];

export default function RhLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-t-lg px-4 py-2 text-sm text-muted hover:bg-surface hover:text-ink"
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
