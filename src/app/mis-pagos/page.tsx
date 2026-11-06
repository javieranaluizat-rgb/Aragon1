import Link from "next/link";
import { casasDe, exigirUsuario } from "@/lib/auth";
import { q } from "@/lib/db";
import { dinero, fecha } from "@/lib/formato";
import { Estado } from "@/components/estado";

export const metadata = { title: "Mis pagos" };
export const dynamic = "force-dynamic";

interface Fila {
  id: number;
  casa_id: number;
  monto: number;
  fecha_pago: string | null;
  concepto: string | null;
  estado: string;
  nota_admin: string | null;
}

export default async function MisPagos() {
  const s = await exigirUsuario("/mis-pagos");
  // Los administradores ven sus pagos desde el panel; aquí solo las casas propias.
  const casas = s.rol === "admin" ? [] : await casasDe(s);
  const pagos = casas.length
    ? await q<Fila>(
        `SELECT id, casa_id, monto::float8 AS monto, to_char(fecha_pago, 'YYYY-MM-DD') AS fecha_pago,
                concepto, estado, nota_admin
         FROM pagos WHERE casa_id = ANY($1::int[])
         ORDER BY fecha_pago DESC NULLS LAST, id DESC LIMIT 100`,
        [casas.map((c) => c.id)],
      )
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mis pagos</h1>
        <p className="text-carbon-suave">Estado de los comprobantes que has subido.</p>
      </div>

      {s.rol === "admin" && (
        <p className="tarjeta text-sm">
          Los pagos de todas las casas están en el <Link href="/admin" className="text-verde underline">panel de administración</Link>.
        </p>
      )}

      {s.rol !== "admin" && casas.length === 0 && (
        <p className="tarjeta text-sm">Tu usuario todavía no tiene casas asignadas.</p>
      )}

      {casas.map((casa) => {
        const propios = pagos.filter((p) => p.casa_id === casa.id);
        return (
          <div key={casa.id} className="tarjeta overflow-x-auto p-0">
            <div className="flex items-center justify-between border-b border-piedra-200 px-5 py-3">
              <span className="font-semibold">Casa {casa.numero}</span>
              <span className="text-sm text-carbon-suave">Alícuota {dinero(casa.alicuota)}</span>
            </div>
            {propios.length === 0 ? (
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
                  {propios.map((p) => (
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
        );
      })}
    </div>
  );
}
