"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

type NavItem = { href: string; label: string; icon: string };

export function MobileNav({
  items,
  profileName,
  roleLabel,
  signOutAction,
}: {
  items: NavItem[];
  profileName: string;
  roleLabel: string;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border bg-surface px-4 py-3 md:hidden">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight text-ink">tucupy · gestão</span>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? "Fechar" : "Menu"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-1 border-t border-border pt-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface2 hover:text-ink"
            >
              <span className="w-4 text-center text-primary">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <div className="mt-2 border-t border-border pt-3">
            <div className="px-2 text-sm font-medium text-ink">{profileName}</div>
            <div className="px-2 text-xs text-muted">{roleLabel}</div>
            <form action={signOutAction} className="mt-2 px-2">
              <Button variant="ghost" className="w-full" type="submit">
                Sair
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
