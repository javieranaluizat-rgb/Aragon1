import "server-only";
import { q, q1 } from "./db";
import type { MovimientoLeido } from "./ai";

/**
 * Cruce de los comprobantes que suben los residentes con los movimientos del
 * estado de cuenta bancario.
 *
 * Un pago y un movimiento son candidatos cuando tienen el mismo monto y sus
 * fechas están a 5 días o menos. Entre los candidatos se da más peso a:
 *   - el número de comprobante del residente aparece en el movimiento
 *   - el movimiento menciona la casa ("Casa 12", "C12"...)
 *   - la fecha es exactamente la misma
 * Los cruces seguros se aprueban solos; los dudosos quedan para que el
 * administrador los confirme con un clic.
 */

const DIAS_TOLERANCIA = 5;

interface PagoPendiente {
  id: number;
  casa: string;
  monto: number;
  fecha_pago: string | null;
  referencia: string | null;
  ordenante: string | null;
}

interface Movimiento {
  id: number;
  fecha: string | null;
  monto: number;
  referencia: string | null;
  descripcion: string | null;
}

export interface Cruce {
  pago: PagoPendiente;
  movimiento: Movimiento;
  motivos: string[];
  seguro: boolean;
}

const digitos = (s: string | null) => (s ?? "").replace(/\D/g, "");

function coincideReferencia(refPago: string | null, mov: Movimiento) {
  const rp = digitos(refPago).replace(/^0+/, "");
  if (rp.length < 4) return false;
  const candidatos = [
    digitos(mov.referencia),
    ...((mov.descripcion ?? "").match(/\d{4,}/g) ?? []),
  ]
    .map((c) => c.replace(/^0+/, ""))
    .filter((c) => c.length >= 4);
  return candidatos.some(
    (c) =>
      c === rp ||
      (c.length >= 6 && rp.length >= 6 && (rp.endsWith(c) || c.endsWith(rp))),
  );
}

function coincideCasa(casa: string, mov: Movimiento) {
  const texto = `${mov.descripcion ?? ""} ${mov.referencia ?? ""}`;
  const numero = casa.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(?:casa|cs|c|lote|villa|dpto|depto|dep|unidad)\\s*[.#:-]?\\s*0*${numero}(?![0-9])`,
    "i",
  );
  return re.test(texto);
}

function diasEntre(a: string | null, b: string | null) {
  if (!a || !b) return null;
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
}

export async function calcularCruces(): Promise<Cruce[]> {
  const pagos = await q<PagoPendiente>(`
    SELECT p.id, c.numero AS casa, p.monto::float8 AS monto,
           to_char(p.fecha_pago, 'YYYY-MM-DD') AS fecha_pago,
           p.referencia, p.ordenante
    FROM pagos p JOIN casas c ON c.id = p.casa_id
    WHERE p.estado = 'pendiente'`);
  const movimientos = await q<Movimiento>(`
    SELECT m.id, to_char(m.fecha, 'YYYY-MM-DD') AS fecha,
           m.monto::float8 AS monto, m.referencia, m.descripcion
    FROM movimientos m
    WHERE NOT EXISTS (SELECT 1 FROM pagos p WHERE p.movimiento_id = m.id)`);

  type Par = { pago: PagoPendiente; mov: Movimiento; puntos: number; motivos: string[]; fuerte: boolean };
  const pares: Par[] = [];

  for (const pago of pagos) {
    for (const mov of movimientos) {
      if (Math.abs(pago.monto - mov.monto) >= 0.01) continue;
      const dias = diasEntre(pago.fecha_pago, mov.fecha);
      if (dias != null && dias > DIAS_TOLERANCIA) continue;

      const motivos = ["Mismo monto"];
      let puntos = 0;
      let fuerte = false;
      if (coincideReferencia(pago.referencia, mov)) {
        puntos += 4;
        fuerte = true;
        motivos.push("Coincide el número de comprobante");
      }
      if (coincideCasa(pago.casa, mov)) {
        puntos += 3;
        fuerte = true;
        motivos.push(`El banco menciona la casa ${pago.casa}`);
      }
      if (dias === 0) {
        puntos += 1;
        motivos.push("Misma fecha");
      } else if (dias != null) {
        puntos += 0.5 - dias / 20;
        motivos.push(`${Math.round(dias)} día(s) de diferencia`);
      }
      pares.push({ pago, mov, puntos, motivos, fuerte });
    }
  }

  // Cuántos candidatos tiene cada pago y cada movimiento: si un pago y un
  // movimiento solo pueden ir juntos y la fecha coincide, el cruce es seguro.
  const porPago = new Map<number, number>();
  const porMov = new Map<number, number>();
  for (const p of pares) {
    porPago.set(p.pago.id, (porPago.get(p.pago.id) ?? 0) + 1);
    porMov.set(p.mov.id, (porMov.get(p.mov.id) ?? 0) + 1);
  }

  pares.sort((a, b) => b.puntos - a.puntos);
  const pagosUsados = new Set<number>();
  const movsUsados = new Set<number>();
  const cruces: Cruce[] = [];
  for (const p of pares) {
    if (pagosUsados.has(p.pago.id) || movsUsados.has(p.mov.id)) continue;
    pagosUsados.add(p.pago.id);
    movsUsados.add(p.mov.id);
    const unico = porPago.get(p.pago.id) === 1 && porMov.get(p.mov.id) === 1;
    const mismaFecha = diasEntre(p.pago.fecha_pago, p.mov.fecha) === 0;
    cruces.push({
      pago: p.pago,
      movimiento: p.mov,
      motivos: p.motivos,
      seguro: p.fuerte || (unico && mismaFecha),
    });
  }
  return cruces;
}

export async function aplicarCruce(
  pagoId: number,
  movimientoId: number,
  forma: "automatica" | "manual",
) {
  await q(
    `UPDATE pagos SET estado = 'conciliado', movimiento_id = $2,
       forma_verificacion = $3, verificado = now()
     WHERE id = $1 AND estado = 'pendiente'
       AND NOT EXISTS (SELECT 1 FROM pagos WHERE movimiento_id = $2)`,
    [pagoId, movimientoId, forma],
  );
}

/** Aplica todos los cruces seguros. Devuelve cuántos pagos se conciliaron. */
export async function conciliarAutomaticamente() {
  let total = 0;
  // Al aprobar unos cruces, otros pagos pueden quedarse con un solo candidato
  // posible, así que se repite hasta que no aparezcan cruces seguros nuevos.
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    const seguros = (await calcularCruces()).filter((c) => c.seguro);
    if (seguros.length === 0) break;
    for (const c of seguros) {
      await aplicarCruce(c.pago.id, c.movimiento.id, "automatica");
      total++;
    }
  }
  return total;
}

/** Guarda los movimientos de un estado de cuenta, ignorando los ya cargados. */
export async function guardarMovimientos(nombreArchivo: string, movs: MovimientoLeido[]) {
  const carga = await q1<{ id: number }>(
    "INSERT INTO cargas_estado_cuenta (nombre_archivo) VALUES ($1) RETURNING id",
    [nombreArchivo],
  );
  const cargaId = carga!.id;

  const vistos = new Map<string, number>();
  let nuevos = 0;
  for (const m of movs) {
    const base = [
      m.fecha ?? "",
      m.monto.toFixed(2),
      digitos(m.referencia),
      (m.descripcion ?? "").toLowerCase().replace(/\s+/g, " ").trim(),
    ].join("|");
    // Dos movimientos idénticos en el mismo archivo son movimientos distintos.
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    const r = await q(
      `INSERT INTO movimientos (carga_id, fecha, monto, referencia, descripcion, huella)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (huella) DO NOTHING RETURNING id`,
      [cargaId, m.fecha, m.monto, m.referencia, m.descripcion, `${base}#${n}`],
    );
    nuevos += r.length;
  }
  await q("UPDATE cargas_estado_cuenta SET total_movimientos = $2 WHERE id = $1", [
    cargaId,
    nuevos,
  ]);
  return { cargaId, leidos: movs.length, nuevos, repetidos: movs.length - nuevos };
}
