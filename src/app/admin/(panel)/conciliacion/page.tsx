import Link from "next/link";
import { q } from "@/lib/db";
import { calcularCruces } from "@/lib/conciliacion";
import { dinero, fecha } from "@/lib/formato";
import { confirmarCruce, volverACruzar } from "../../acciones";
import { SubirEstadoCuenta } from "./subir";

interface Mov {
  id: number;
  fecha: string | null;
  monto: number;
  referencia: string | null;
  descripcion: string | null;
}

interface PagoSolo {
  id: number;
  casa: string;
  monto: number;
  fecha_pago: string | null;
  referencia: string | null;
}

export default async function Conciliacion() {
  const cruces = await calcularCruces();
  const posibles = cruces.filter((c) => !c.seguro);
  const seguros = cruces.filter((c) => c.seguro);
  const conCandidato = new Set(cruces.map((c) => c.pago.id));
  const movConPago = new Set(cruces.map((c) => c.movimiento.id));

  const pendientes = (
    await q<PagoSolo>(
      `SELECT p.id, c.numero AS casa, p.monto::float8 AS monto,
              to_char(p.fecha_pago, 'YYYY-MM-DD') AS fecha_pago, p.referencia
       FROM pagos p JOIN casas c ON c.id = p.casa_id
       WHERE p.estado = 'pendiente' ORDER BY p.fecha_pago`,
    )
  ).filter((p) => !conCandidato.has(p.id));

  const libres = (
    await q<Mov>(
      `SELECT m.id, to_char(m.fecha, 'YYYY-MM-DD') AS fecha, m.monto::float8 AS monto,
              m.referencia, m.descripcion
       FROM movimientos m
       WHERE NOT EXISTS (SELECT 1 FROM pagos p WHERE p.movimiento_id = m.id)
       ORDER BY m.fecha DESC LIMIT 100`,
    )
  ).filter((m) => !movConPago.has(m.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cruce con el banco</h1>
        <p className="text-carbon-suave">
          Sube el estado de cuenta y la app aprueba sola los pagos que coinciden con seguridad.
          Los dudosos quedan abajo para que los confirmes.
        </p>
      </div>

      <SubirEstadoCuenta />

      {seguros.length > 0 && (
        <form action={volverACruzar} className="tarjeta flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Hay <strong>{seguros.length}</strong> pago(s) que coinciden con seguridad y aún no se aprobaron.
          </p>
          <button className="boton">Aprobarlos ahora</button>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Posibles coincidencias <span className="text-carbon-suave">({posibles.length})</span>
        </h2>
        {posibles.length === 0 ? (
          <p className="text-sm text-carbon-suave">No hay coincidencias dudosas por revisar.</p>
        ) : (
          <div className="space-y-3">
            {posibles.map((c) => (
              <div key={`${c.pago.id}-${c.movimiento.id}`} className="tarjeta grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
                <div className="text-sm">
                  <p className="text-xs uppercase tracking-wide text-carbon-suave">Comprobante del residente</p>
                  <p>
                    <strong>Casa {c.pago.casa}</strong> · {dinero(c.pago.monto)} · {fecha(c.pago.fecha_pago)}
                  </p>
                  <p className="text-carbon-suave">
                    Ref. {c.pago.referencia ?? "—"} ·{" "}
                    <Link href={`/admin/pagos/${c.pago.id}`} className="text-verde underline">ver comprobante</Link>
                  </p>
                </div>
                <div className="text-sm">
                  <p className="text-xs uppercase tracking-wide text-carbon-suave">Movimiento del banco</p>
                  <p>{dinero(c.movimiento.monto)} · {fecha(c.movimiento.fecha)} · Ref. {c.movimiento.referencia ?? "—"}</p>
                  <p className="text-carbon-suave">{c.movimiento.descripcion}</p>
                  <p className="mt-1 text-xs text-ambar">{c.motivos.join(" · ")}</p>
                </div>
                <form action={confirmarCruce}>
                  <input type="hidden" name="pago" value={c.pago.id} />
                  <input type="hidden" name="movimiento" value={c.movimiento.id} />
                  <button className="boton w-full">Confirmar</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Comprobantes sin movimiento en el banco <span className="text-carbon-suave">({pendientes.length})</span>
          </h2>
          <p className="text-sm text-carbon-suave">
            Puede que el dinero aún no se acredite o que el comprobante sea incorrecto. Revísalos
            después de subir el siguiente estado de cuenta.
          </p>
          <ul className="tarjeta divide-y divide-piedra-100 p-0 text-sm">
            {pendientes.length === 0 && <li className="px-4 py-3 text-carbon-suave">Ninguno.</li>}
            {pendientes.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span>
                  <strong>Casa {p.casa}</strong> · {dinero(p.monto)} · {fecha(p.fecha_pago)}
                  <span className="block font-mono text-xs text-carbon-suave">Ref. {p.referencia}</span>
                </span>
                <Link href={`/admin/pagos/${p.id}`} className="text-verde underline">Ver</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Depósitos sin comprobante <span className="text-carbon-suave">({libres.length})</span>
          </h2>
          <p className="text-sm text-carbon-suave">
            Dinero que entró a la cuenta y nadie reportó todavía.
          </p>
          <ul className="tarjeta divide-y divide-piedra-100 p-0 text-sm">
            {libres.length === 0 && <li className="px-4 py-3 text-carbon-suave">Ninguno.</li>}
            {libres.map((m) => (
              <li key={m.id} className="px-4 py-2.5">
                <strong>{dinero(m.monto)}</strong> · {fecha(m.fecha)} · Ref. {m.referencia ?? "—"}
                <span className="block text-xs text-carbon-suave">{m.descripcion}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
