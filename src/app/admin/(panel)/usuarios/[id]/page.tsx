import Link from "next/link";
import { notFound } from "next/navigation";
import { q1 } from "@/lib/db";
import { EditarUsuario } from "./editar";

interface Usuario {
  id: number;
  usuario: string;
  nombre: string;
  rol: "residente" | "admin";
  activo: boolean;
  casas: string | null;
}

export default async function PaginaUsuario({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await q1<Usuario>(
    `SELECT u.id, u.usuario, u.nombre, u.rol, u.activo,
            string_agg(c.numero, ', ' ORDER BY CASE WHEN c.numero ~ '^[0-9]+$' THEN c.numero::int END, c.numero) AS casas
     FROM usuarios u
     LEFT JOIN usuario_casas uc ON uc.usuario_id = u.id
     LEFT JOIN casas c ON c.id = uc.casa_id
     WHERE u.id = $1 GROUP BY u.id`,
    [Number(id) || 0],
  );
  if (!u) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/admin/usuarios" className="text-sm text-verde underline">← Volver a usuarios</Link>
      <h1 className="text-2xl font-semibold">{u.nombre}</h1>
      <EditarUsuario usuario={u} />
    </div>
  );
}
