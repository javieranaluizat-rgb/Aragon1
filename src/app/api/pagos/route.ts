import { NextResponse } from "next/server";
import { buscarCasa } from "@/lib/casas";
import { leerArchivoComprobante } from "@/lib/archivos";
import { q1 } from "@/lib/db";
import { aFecha, aNumero } from "@/lib/estado-cuenta";

const corto = (v: FormDataEntryValue | null, max = 200) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

export async function POST(req: Request) {
  const form = await req.formData();
  const casa = await buscarCasa(form.get("casa"));
  if (!casa) {
    return NextResponse.json({ error: "Esa casa no está registrada." }, { status: 400 });
  }
  const archivo = await leerArchivoComprobante(form.get("archivo"));
  if ("error" in archivo) {
    return NextResponse.json({ error: archivo.error }, { status: 400 });
  }

  const monto = aNumero(corto(form.get("monto")));
  if (monto == null || monto <= 0 || monto > 100000) {
    return NextResponse.json({ error: "Escribe el monto pagado." }, { status: 400 });
  }
  const fecha = aFecha(corto(form.get("fecha")));
  if (!fecha) {
    return NextResponse.json({ error: "Escribe la fecha del pago." }, { status: 400 });
  }
  if (Date.parse(fecha) > Date.now() + 86400000) {
    return NextResponse.json({ error: "La fecha del pago no puede ser futura." }, { status: 400 });
  }
  const referencia = corto(form.get("referencia"), 60);
  if (!referencia) {
    return NextResponse.json(
      { error: "Escribe el número de comprobante o referencia." },
      { status: 400 },
    );
  }

  const repetido = await q1(
    "SELECT 1 FROM pagos WHERE referencia = $1 AND estado <> 'rechazado'",
    [referencia],
  );
  if (repetido) {
    return NextResponse.json(
      { error: `El comprobante número ${referencia} ya fue registrado antes.` },
      { status: 409 },
    );
  }

  let lecturaIa: unknown = null;
  try {
    const crudo = corto(form.get("lectura"), 5000);
    lecturaIa = crudo ? JSON.parse(crudo) : null;
  } catch {
    lecturaIa = null;
  }

  const pago = await q1<{ id: number }>(
    `INSERT INTO pagos (casa_id, monto, fecha_pago, banco, referencia, ordenante,
       cuenta_destino, concepto, archivo, archivo_tipo, archivo_nombre, lectura_ia)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      casa.id,
      Math.round(monto * 100) / 100,
      fecha,
      corto(form.get("banco"), 80),
      referencia,
      corto(form.get("ordenante"), 120),
      corto(form.get("cuenta_destino"), 40),
      corto(form.get("concepto"), 120),
      archivo.datos,
      archivo.tipo,
      archivo.nombre.slice(0, 120),
      lecturaIa ? JSON.stringify(lecturaIa) : null,
    ],
  );

  return NextResponse.json({ id: pago!.id, casa: casa.numero });
}
