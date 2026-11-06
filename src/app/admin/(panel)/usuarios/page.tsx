import Link from "next/link";
import { q } from "@/lib/db";
import { NuevoUsuario } from "./nuevo";

interface Fila {
  id: number;
  usuario: string;
  nombre: string;
  rol: string;
  activo: boolean;
  debe_cambiar_clave: boolean;
  ultimo_ingreso: string | null;
  casas: string | null;
}

export default async function Usuarios({
  searchParams,
}: {
  searchParams: Promise<{ buscar?: string }>;
}) {
  const { buscar = "" } = await searchParams;
  const usuarios = await q<Fila>(
    `SELECT u.id, u.usuario, u.nombre, u.rol, u.activo, u.debe_cambiar_clave,
            to_char(u.ultimo_ingreso AT TIME ZONE 'America/Guayaquil', 'DD/MM/YYYY') AS ultimo_ingreso,
            string_agg(c.numero, ', ' ORDER BY CASE WHEN c.numero ~ '^[0-9]+$' THEN c.numero::int END, c.numero) AS casas
     FROM usuarios u
     LEFT JOIN usuario_casas uc ON uc.usuario_id = u.id
     LEFT JOIN casas c ON c.id = uc.casa_id
     WHERE $1 = '' OR u.nombre ILIKE '%' || $1 || '%' OR u.usuario ILIKE '%' || $1 || '%' OR EXISTS (SELECT 1 FROM usuario_casas x JOIN casas y ON y.id = x.casa_id
                   WHERE x.usuario_id = u.id AND upper(y.numero) = upper($1))
     GROUP BY u.id
     ORDER BY u.activo DESC, u.nombre`,
    [buscar.trim()],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-carbon-suave">
          Cada residente entra con su usuario y solo puede subir pagos de las casas que tenga asignadas.
        </p>
      </div>

      <NuevoUsuario />

      <form className="flex gap-2">
        <input name="buscar" defaultValue={buscar} placeholder="Buscar por nombre, usuario o casa" className="campo max-w-xs py-1.5 text-sm" />
        <button className="boton-sec py-1.5 text-sm">Buscar</button>
      </form>

      <div className="tarjeta overflow-x-auto p-0">
        {usuarios.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-carbon-suave">Todavía no hay usuarios.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-piedra-50 text-left text-carbon-suave">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">Casa(s)</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={`border-t border-piedra-100 ${u.activo ? "" : "opacity-50"}`}>
                  <td className="px-4 py-2.5">
                    {u.nombre}
                    {u.rol === "admin" && (
                      <span className="ml-2 rounded-full bg-carbon px-2 py-0.5 text-xs text-white">Admin</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{u.usuario}</td>
                  <td className="px-3 py-2.5">{u.casas ?? <span className="text-rojo">Sin casa</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-carbon-suave">
                    {!u.activo
                      ? "Desactivado"
                      : u.debe_cambiar_clave
                        ? "Aún no entra"
                        : `Último ingreso ${u.ultimo_ingreso ?? "—"}`}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/usuarios/${u.id}`} className="text-verde underline">Editar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
