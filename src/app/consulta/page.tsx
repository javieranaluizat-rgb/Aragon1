import Link from "next/link";
import { buscarCasa } from "@/lib/casas";
import { q } from "@/lib/db";
import { dinero, fecha } from "@/lib/formato";
import { Estado } from "@/components/estado";

export const metadata = { title: "Mis pagos" };
export const dynamic = "force-dynamic";

interface Fila {
  id: number;
  monto: number;
  fecha_pago: string | null;
  concepto: string | null;
  estado: string;
  nota_admin: string | null;
}

export default async function Consulta({
  searchParams,
}: {
  searchParams: Promise<{ casa?: string }>;
}) {
  const { casa: buscada } = await searchParams;
  const casa = buscada ? await buscarCasa(buscada) : undefined;
  const pagos = casa
    ? await q<Fila>(
        `SELECT id, monto::float8 AS monto, to_char(fecha_pago, 'YYYY-MM-DD') AS fecha_pago,
                concepto, estado, nota_admin
         FROM pagos WHERE casa_id = $1 ORDER BY fecha_pago DESC NULLS LAST, id DESC LIMIT 50`,
        [casa.id],
      )
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mis pagos</h1>
        <p className="text-carbon-suave">Consulta el estado de los comprobantes de tu casa.</p>
      </div>

      <form className="tarjeta flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="casa" className="etiqueta">Número de casa</label>
          <input id="casa" name="casa" className="campo" defaultValue={buscada ?? ""} required />
        </div>
        <button className="boton">Consultar</button>
      </form>

      {buscada && !casa && (
        <p className="rounded-lg bg-rojo-claro px-4 py-3 text-sm text-rojo">
          No encontramos la casa “{buscada}”.
        </p>
      )}

      {casa && (
        <div className="tarjeta overflow-x-auto p-0">
          <div className="border-b border-piedra-200 px-5 py-3 font-semibold">Casa {casa.numero}</div>
          {pagos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-carbon-suave">
              Aún no hay pagos registrados.{" "}
              <Link href="/pagar" className="text-verde underline">Subir un comprobante</Link>
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-piedra-50 text-left text-carbon-suave">
                <tr>
                  <th className="px-5 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Concepto</th>
                  <th className="px-3 py-2 text-right font-medium">Monto</th>
                  <th className="px-5 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id} className="border-t border-piedra-100 align-top">
                    <td className="whitespace-nowrap px-5 py-3">{fecha(p.fecha_pago)}</td>
                    <td className="px-3 py-3">
                      {p.concepto ?? "—"}
                      {p.estado === "rechazado" && p.nota_admin && (
                        <p className="mt-1 text-xs text-rojo">{p.nota_admin}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{dinero(p.monto)}</td>
                    <td className="px-5 py-3"><Estado estado={p.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
