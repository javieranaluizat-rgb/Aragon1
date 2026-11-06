import Link from "next/link";
import { q, q1 } from "@/lib/db";
import { dinero, fecha } from "@/lib/formato";
import { Estado } from "@/components/estado";

interface Fila {
  id: number;
  casa: string;
  monto: number;
  fecha_pago: string | null;
  referencia: string | null;
  banco: string | null;
  ordenante: string | null;
  estado: string;
  forma_verificacion: string | null;
}

const FILTROS = [
  ["pendiente", "Pendientes"],
  ["conciliado", "Aprobados"],
  ["rechazado", "Rechazados"],
  ["todos", "Todos"],
] as const;

export default async function PanelPagos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; casa?: string }>;
}) {
  const { estado = "pendiente", casa } = await searchParams;
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (estado !== "todos") {
    params.push(estado);
    condiciones.push(`p.estado = $${params.length}`);
  }
  if (casa) {
    params.push(casa.trim().toUpperCase());
    condiciones.push(`upper(c.numero) = $${params.length}`);
  }
  const pagos = await q<Fila>(
    `SELECT p.id, c.numero AS casa, p.monto::float8 AS monto,
            to_char(p.fecha_pago, 'YYYY-MM-DD') AS fecha_pago, p.referencia, p.banco,
            p.ordenante, p.estado, p.forma_verificacion
     FROM pagos p JOIN casas c ON c.id = p.casa_id
     ${condiciones.length ? "WHERE " + condiciones.join(" AND ") : ""}
     ORDER BY p.creado DESC LIMIT 200`,
    params,
  );

  const resumen = await q1<{ pendientes: number; monto_pendiente: number; aprobados_mes: number; monto_mes: number }>(
    `SELECT
       count(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
       coalesce(sum(monto) FILTER (WHERE estado = 'pendiente'), 0)::float8 AS monto_pendiente,
       count(*) FILTER (WHERE estado = 'conciliado' AND date_trunc('month', verificado) = date_trunc('month', now()))::int AS aprobados_mes,
       coalesce(sum(monto) FILTER (WHERE estado = 'conciliado' AND date_trunc('month', verificado) = date_trunc('month', now())), 0)::float8 AS monto_mes
     FROM pagos`,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="tarjeta">
          <p className="text-sm text-carbon-suave">Pendientes de verificar</p>
          <p className="text-3xl font-semibold">{resumen?.pendientes ?? 0}</p>
          <p className="text-sm text-carbon-suave">{dinero(resumen?.monto_pendiente)}</p>
        </div>
        <div className="tarjeta">
          <p className="text-sm text-carbon-suave">Aprobados este mes</p>
          <p className="text-3xl font-semibold">{resumen?.aprobados_mes ?? 0}</p>
          <p className="text-sm text-carbon-suave">{dinero(resumen?.monto_mes)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {FILTROS.map(([valor, texto]) => (
            <Link
              key={valor}
              href={`/admin?estado=${valor}${casa ? `&casa=${encodeURIComponent(casa)}` : ""}`}
              className={`rounded-full px-3 py-1 ${estado === valor ? "bg-carbon text-white" : "bg-white text-carbon-suave ring-1 ring-piedra-200"}`}
            >
              {texto}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="estado" value={estado} />
          <input name="casa" defaultValue={casa} placeholder="Casa" className="campo w-24 py-1.5 text-sm" />
          <button className="boton-sec py-1.5 text-sm">Filtrar</button>
        </form>
      </div>

      <div className="tarjeta overflow-x-auto p-0">
        {pagos.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-carbon-suave">No hay pagos en esta lista.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-piedra-50 text-left text-carbon-suave">
              <tr>
                <th className="px-4 py-2 font-medium">Casa</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 text-right font-medium">Monto</th>
                <th className="px-3 py-2 font-medium">Comprobante</th>
                <th className="px-3 py-2 font-medium">Pagó</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} className="border-t border-piedra-100">
                  <td className="px-4 py-2.5 font-semibold">{p.casa}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{fecha(p.fecha_pago)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{dinero(p.monto)}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs">{p.referencia}</span>
                    <span className="block text-xs text-carbon-suave">{p.banco}</span>
                  </td>
                  <td className="px-3 py-2.5">{p.ordenante ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <Estado estado={p.estado} />
                    {p.forma_verificacion === "automatica" && (
                      <span className="block text-xs text-carbon-suave">automático</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/pagos/${p.id}`} className="text-verde underline">Ver</Link>
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
