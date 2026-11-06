import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { CONJUNTO } from "@/lib/config";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${CONJUNTO.nombre} · Pagos de alícuota`,
  description: `Registro y verificación de pagos de alícuota del conjunto ${CONJUNTO.nombre}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.variable} min-h-screen font-sans antialiased`}>
        <header className="border-b border-piedra-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/samara.png"
                alt=""
                width={56}
                height={36}
                className="h-9 w-14 rounded-md object-cover"
                priority
              />
              <span className="whitespace-nowrap text-lg font-semibold tracking-wide">{CONJUNTO.nombre}</span>
            </Link>
            <nav className="flex gap-4 text-sm text-carbon-suave">
              <Link href="/pagar" className="hover:text-verde">Subir pago</Link>
              <Link href="/consulta" className="hover:text-verde">Mis pagos</Link>
              <Link href="/admin" className="hover:text-verde">Administración</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
