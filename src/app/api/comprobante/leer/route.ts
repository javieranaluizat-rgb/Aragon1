import { NextResponse } from "next/server";
import { buscarCasa } from "@/lib/casas";
import { leerArchivoComprobante } from "@/lib/archivos";
import { iaDisponible, leerComprobante, type LecturaComprobante } from "@/lib/ai";
import { CONJUNTO } from "@/lib/config";
import { q1 } from "@/lib/db";

export const maxDuration = 60;

interface Aviso {
  tipo: "error" | "alerta" | "info";
  texto: string;
}

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

  const avisos: Aviso[] = [];
  let lectura: LecturaComprobante | null = null;

  if (!iaDisponible()) {
    avisos.push({
      tipo: "info",
      texto: "La lectura automática no está activada. Completa los datos del comprobante.",
    });
  } else {
    try {
      lectura = await leerComprobante(archivo.datos, archivo.tipo);
    } catch (e) {
      console.error("Error leyendo comprobante", e);
    }
    if (!lectura) {
      avisos.push({
        tipo: "alerta",
        texto: "No pudimos leer el comprobante automáticamente. Completa los datos a mano.",
      });
    } else if (!lectura.es_comprobante) {
      avisos.push({
        tipo: "error",
        texto:
          lectura.problema ??
          "El archivo no parece un comprobante de pago. Sube la captura o el PDF que te dio tu banco.",
      });
    } else if (!lectura.legible) {
      avisos.push({
        tipo: "alerta",
        texto:
          lectura.problema ??
          "Algunos datos no se leen bien. Revísalos o toma la foto de nuevo con más luz.",
      });
    }
  }

  if (lectura?.referencia) {
    const repetido = await q1(
      "SELECT 1 FROM pagos WHERE referencia = $1 AND estado <> 'rechazado'",
      [lectura.referencia],
    );
    if (repetido) {
      avisos.push({
        tipo: "error",
        texto: `El comprobante número ${lectura.referencia} ya fue registrado antes.`,
      });
    }
  }

  const ultimos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-4);
  const cuentaLeida = ultimos(lectura?.cuenta_destino);
  const cuentaConjunto = ultimos(CONJUNTO.cuenta);
  if (cuentaLeida.length >= 3 && cuentaConjunto && !cuentaConjunto.endsWith(cuentaLeida)) {
    avisos.push({
      tipo: "alerta",
      texto: `La cuenta destino del comprobante (…${cuentaLeida}) no parece ser la del conjunto (…${cuentaConjunto}). Verifica que transferiste a la cuenta correcta.`,
    });
  }

  if (lectura?.monto != null && casa.alicuota > 0 && lectura.monto < casa.alicuota) {
    avisos.push({
      tipo: "info",
      texto: `El monto es menor que la alícuota de la casa ($${casa.alicuota.toFixed(2)}). Se registrará como abono.`,
    });
  }

  return NextResponse.json({ casa: casa.numero, lectura, avisos });
}
