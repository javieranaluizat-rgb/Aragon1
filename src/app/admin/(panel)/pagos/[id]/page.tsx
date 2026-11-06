import Link from "next/link";
import { notFound } from "next/navigation";
import { q1 } from "@/lib/db";
import { dinero, fecha } from "@/lib/formato";
import { Estado } from "@/components/estado";
import { aprobarManual, devolverAPendiente, rechazar } from "../../../acciones";

interface Detalle {
  id: number;
  casa: string;
  propietario: string | null;
  alicuota: number;
  monto: number;
  fecha_pago: string | null;
  banco: string | null;
  referencia: string | null;
  ordenante: string | null;
  cuenta_destino: string | null;
  concepto: string | null;
  archivo_tipo: string;
  estado: string;
  forma_verificacion: string | null;
  nota_admin: string | null;
  creado: string;
  mov_fecha: string | null;
  mov_monto: number | null;
  mov_referencia: string | null;
  mov_descripcion: string | null;
}

export default async function DetallePago({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await q1<Detalle>(
    `SELECT p.id, c.numero AS casa, c.propietario, c.alicuota::float8 AS alicuota,
            p.monto::float8 AS monto, to_char(p.fecha_pago, 'YYYY-MM-DD') AS fecha_pago,
            p.banco, p.referencia, p.ordenante, p.cuenta_destino, p.concepto, p.archivo_tipo,
            p.estado, p.forma_verificacion, p.nota_admin,
            to_char(p.creado AT TIME ZONE 'America/Guayaquil', 'DD/MM/YYYY HH24:MI') AS creado,
            to_char(m.fecha, 'YYYY-MM-DD') AS mov_fecha, m.monto::float8 AS mov_monto,
            m.referencia AS mov_referencia, m.descripcion AS mov_descripcion
     FROM pagos p JOIN casas c ON c.id = p.casa_id
     LEFT JOIN movimientos m ON m.id = p.movimiento_id
     WHERE p.id = $1`,
    [Number(id) || 0],
  );
  if (!p) notFound();

  const url = `/api/comprobante/${p.id}`;
  const datos: [string, string][] = [
    ["Casa", `${p.casa}${p.propietario ? ` · ${p.propietario}` : ""}`],
    ["Monto", `${dinero(p.monto)} (alícuota ${dinero(p.alicuota)})`],
    ["Fecha del pago", fecha(p.fecha_pago)],
    ["N.º de comprobante", p.referencia ?? "—"],
    ["Banco", p.banco ?? "—"],
    ["Pagó", p.ordenante ?? "—"],
    ["Cuenta destino", p.cuenta_destino ?? "—"],
    ["Concepto", p.concepto ?? "—"],
    ["Subido", p.creado],
  ];

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm text-verde underline">← Volver</Link>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="tarjeta p-2">
          {p.archivo_tipo === "application/pdf" ? (
            <iframe src={url} title="Comprobante" className="h-[70vh] w-full rounded-lg" />
          ) : (
            <a href={url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Comprobante" className="w-full rounded-lg" />
            </a>
          )}
        </div>

        <div className="space-y-4">
          <div className="tarjeta space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">Pago #{p.id}</h1>
              <Estado estado={p.estado} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {datos.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-carbon-suave">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {p.nota_admin && (
              <p className="rounded-lg bg-piedra-100 px-3 py-2 text-sm">Nota: {p.nota_admin}</p>
            )}
          </div>

          {p.mov_monto != null && (
            <div className="tarjeta text-sm">
              <h2 className="mb-2 font-semibold">
                Movimiento del banco {p.forma_verificacion === "automatica" ? "(cruce automático)" : ""}
              </h2>
              <p>{fecha(p.mov_fecha)} · {dinero(p.mov_monto)} · Ref. {p.mov_referencia ?? "—"}</p>
              <p className="text-carbon-suave">{p.mov_descripcion}</p>
            </div>
          )}

          {p.estado === "pendiente" ? (
            <div className="tarjeta space-y-3">
              <p className="text-sm text-carbon-suave">
                Lo normal es aprobar los pagos con el <Link href="/admin/conciliacion" className="text-verde underline">cruce del estado de cuenta</Link>.
                Si ya lo verificaste por otro medio, puedes aprobarlo a mano.
              </p>
              <form className="space-y-3">
                <input type="hidden" name="id" value={p.id} />
                <div>
                  <label htmlFor="nota" className="etiqueta">Nota (la ve el residente si se rechaza)</label>
                  <input id="nota" name="nota" className="campo" placeholder="Ej. El pago no aparece en el banco" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button formAction={aprobarManual} className="boton">Aprobar</button>
                  <button formAction={rechazar} className="boton-sec text-rojo">Rechazar</button>
                </div>
              </form>
            </div>
          ) : (
            <form action={devolverAPendiente}>
              <input type="hidden" name="id" value={p.id} />
              <button className="boton-sec text-sm">Volver a dejarlo pendiente</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
