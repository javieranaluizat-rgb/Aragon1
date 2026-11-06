import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-piedra-200 pb-3 text-sm">
        <Link href="/admin" className="boton-sec py-1.5">Pagos</Link>
        <Link href="/admin/conciliacion" className="boton-sec py-1.5">Cruce con el banco</Link>
        <Link href="/admin/casas" className="boton-sec py-1.5">Casas</Link>
        <Link href="/admin/usuarios" className="boton-sec py-1.5">Usuarios</Link>
      </nav>
      {children}
    </div>
  );
}
