import Link from "next/link";
import { q } from "@/lib/db";
import { dinero } from "@/lib/formato";
import { crearRango, eliminarCasa, guardarCasa } from "../../acciones";

interface Fila {
  id: number;
  numero: string;
  propietario: string | null;
  email: string | null;
  alicuota: number;
  aprobado: number;
  pendiente: number;
  pagos: number;
}

export default async function Casas() {
  const casas = await q<Fila>(
    `SELECT c.id, c.numero, c.propietario, c.email, c.alicuota::float8 AS alicuota,
            coalesce(sum(p.monto) FILTER (WHERE p.estado = 'conciliado'), 0)::float8 AS aprobado,
            coalesce(sum(p.monto) FILTER (WHERE p.estado = 'pendiente'), 0)::float8 AS pendiente,
            count(p.id)::int AS pagos
     FROM casas c LEFT JOIN pagos p ON p.casa_id = c.id
     GROUP BY c.id
     ORDER BY CASE WHEN c.numero ~ '^[0-9]+$' THEN c.numero::int END, c.numero`,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Casas</h1>
        <p className="text-carbon-suave">
          {casas.length} casas registradas. Solo las casas de esta lista pueden subir comprobantes.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={guardarCasa} className="tarjeta space-y-3">
          <h2 className="font-semibold">Agregar o editar una casa</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiqueta" htmlFor="numero">Número</label>
              <input id="numero" name="numero" className="campo" required />
            </div>
            <div>
              <label className="etiqueta" htmlFor="alicuota">Alícuota (USD)</label>
              <input id="alicuota" name="alicuota" className="campo" inputMode="decimal" required />
            </div>
            <div>
              <label className="etiqueta" htmlFor="propietario">Propietario</label>
              <input id="propietario" name="propietario" className="campo" />
            </div>
            <div>
              <label className="etiqueta" htmlFor="email">Correo</label>
              <input id="email" name="email" type="email" className="campo" />
            </div>
          </div>
          <button className="boton">Guardar</button>
        </form>

        <form action={crearRango} className="tarjeta space-y-3">
          <h2 className="font-semibold">Crear varias casas</h2>
          <p className="text-sm text-carbon-suave">Crea las casas numeradas en un rango. Las que ya existen no se tocan.</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="etiqueta" htmlFor="desde">Desde</label>
              <input id="desde" name="desde" type="number" min={1} className="campo" required />
            </div>
            <div>
              <label className="etiqueta" htmlFor="hasta">Hasta</label>
              <input id="hasta" name="hasta" type="number" min={1} className="campo" required />
            </div>
            <div>
              <label className="etiqueta" htmlFor="alicuota-rango">Alícuota</label>
              <input id="alicuota-rango" name="alicuota" className="campo" inputMode="decimal" required />
            </div>
          </div>
          <button className="boton-sec">Crear casas</button>
        </form>
      </div>

      <div className="tarjeta overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-piedra-50 text-left text-carbon-suave">
            <tr>
              <th className="px-4 py-2 font-medium">Casa</th>
              <th className="px-3 py-2 font-medium">Propietario</th>
              <th className="px-3 py-2 text-right font-medium">Alícuota</th>
              <th className="px-3 py-2 text-right font-medium">Aprobado</th>
              <th className="px-3 py-2 text-right font-medium">Pendiente</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {casas.map((c) => (
              <tr key={c.id} className="border-t border-piedra-100">
                <td className="px-4 py-2 font-semibold">{c.numero}</td>
                <td className="px-3 py-2">
                  {c.propietario ?? "—"}
                  {c.email && <span className="block text-xs text-carbon-suave">{c.email}</span>}
                </td>
                <td className="px-3 py-2 text-right">{dinero(c.alicuota)}</td>
                <td className="px-3 py-2 text-right">{dinero(c.aprobado)}</td>
                <td className="px-3 py-2 text-right">{c.pendiente ? dinero(c.pendiente) : "—"}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <Link href={`/admin?estado=todos&casa=${encodeURIComponent(c.numero)}`} className="text-verde underline">
                    Pagos ({c.pagos})
                  </Link>
                  {c.pagos === 0 && (
                    <form action={eliminarCasa} className="ml-3 inline">
                      <input type="hidden" name="id" value={c.id} />
                      <button className="text-xs text-rojo underline">Eliminar</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
