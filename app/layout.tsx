import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tucupy | Gestão",
  description: "Sistema interno de gestão financeira, RH e projetos da Tucupy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
