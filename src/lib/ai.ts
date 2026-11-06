import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Lectura de comprobantes y estados de cuenta con la API de Claude.
 * Si no hay ANTHROPIC_API_KEY configurada, estas funciones devuelven null y la
 * app pide los datos a mano.
 */

const MODELO = "claude-opus-5-5";

export function iaDisponible() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let cliente: Anthropic | null = null;
function claude() {
  if (!cliente) cliente = new Anthropic();
  return cliente;
}

type Bloque = Anthropic.Beta.Messages.BetaContentBlockParam;

function bloqueArchivo(datos: Buffer, tipo: string): Bloque {
  const base64 = datos.toString("base64");
  if (tipo === "application/pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: base64 },
    };
  }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: tipo as "image/jpeg" | "image/png" | "image/webp",
      data: base64,
    },
  };
}

async function extraerJson<T>(
  instrucciones: string,
  archivo: Bloque,
  esquema: Record<string, unknown>,
): Promise<T | null> {
  const respuesta = await claude().beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    // Si el modelo declina la solicitud, la API la reintenta con el modelo
    // alternativo recomendado.
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: esquema },
    },
    messages: [
      { role: "user", content: [archivo, { type: "text", text: instrucciones }] },
    ],
  });

  if (respuesta.stop_reason === "refusal" || respuesta.stop_reason === "max_tokens") {
    return null;
  }
  const texto = respuesta.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  try {
    return JSON.parse(texto) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Comprobantes de pago
// ---------------------------------------------------------------------------

export interface LecturaComprobante {
  es_comprobante: boolean;
  legible: boolean;
  problema: string | null;
  banco: string | null;
  monto: number | null;
  fecha: string | null; // AAAA-MM-DD
  referencia: string | null;
  ordenante: string | null;
  cuenta_destino: string | null;
  beneficiario: string | null;
  tipo: string | null;
}

const texto = (descripcion: string) => ({
  anyOf: [{ type: "string" }, { type: "null" }],
  description: descripcion,
});

const ESQUEMA_COMPROBANTE = {
  type: "object",
  additionalProperties: false,
  required: [
    "es_comprobante", "legible", "problema", "banco", "monto", "fecha",
    "referencia", "ordenante", "cuenta_destino", "beneficiario", "tipo",
  ],
  properties: {
    es_comprobante: {
      type: "boolean",
      description: "true si el archivo es un comprobante de transferencia, depósito o pago bancario",
    },
    legible: {
      type: "boolean",
      description: "true si el monto, la fecha y el número de comprobante se leen con claridad",
    },
    problema: texto(
      "Si no es legible o no es un comprobante: explicación breve en español, dirigida al residente, de qué falla y cómo tomar mejor la foto. null si está bien.",
    ),
    banco: texto("Banco o cooperativa desde donde se hizo el pago"),
    monto: {
      anyOf: [{ type: "number" }, { type: "null" }],
      description: "Monto pagado en dólares, sin comisiones",
    },
    fecha: texto("Fecha de la transacción en formato AAAA-MM-DD"),
    referencia: texto(
      "Número de comprobante, documento, referencia o secuencial de la transacción, tal como aparece (solo el número)",
    ),
    ordenante: texto("Nombre de la persona o cuenta que hizo el pago"),
    cuenta_destino: texto("Número de cuenta destino (puede estar parcialmente oculto, cópialo tal cual)"),
    beneficiario: texto("Nombre del beneficiario o cuenta destino"),
    tipo: texto("Transferencia, depósito, pago en ventanilla, etc."),
  },
};

export async function leerComprobante(
  datos: Buffer,
  tipo: string,
): Promise<LecturaComprobante | null> {
  if (!iaDisponible()) return null;
  return extraerJson<LecturaComprobante>(
    "Este archivo lo subió un residente de un conjunto habitacional en Quito, Ecuador, " +
      "como comprobante del pago de su alícuota. Extrae los datos del comprobante. " +
      "Si un dato no aparece o no se puede leer con seguridad, usa null: no adivines. " +
      "Los montos están en dólares (USD); interpreta comas y puntos según el formato del banco.",
    bloqueArchivo(datos, tipo),
    ESQUEMA_COMPROBANTE,
  );
}

// ---------------------------------------------------------------------------
// Estados de cuenta en PDF o foto
// ---------------------------------------------------------------------------

export interface MovimientoLeido {
  fecha: string | null;
  monto: number;
  referencia: string | null;
  descripcion: string | null;
}

const ESQUEMA_ESTADO = {
  type: "object",
  additionalProperties: false,
  required: ["movimientos"],
  properties: {
    movimientos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fecha", "monto", "referencia", "descripcion"],
        properties: {
          fecha: texto("Fecha del movimiento en formato AAAA-MM-DD"),
          monto: { type: "number", description: "Valor acreditado, positivo, en dólares" },
          referencia: texto("Número de documento, referencia o comprobante del movimiento"),
          descripcion: texto("Concepto o descripción completa del movimiento, tal como aparece"),
        },
      },
    },
  },
};

export async function leerEstadoCuentaDocumento(
  datos: Buffer,
  tipo: string,
): Promise<MovimientoLeido[] | null> {
  if (!iaDisponible()) return null;
  const r = await extraerJson<{ movimientos: MovimientoLeido[] }>(
    "Este es el estado de cuenta bancario de un conjunto habitacional en Ecuador. " +
      "Lista TODOS los movimientos de crédito (dinero que ENTRA a la cuenta: depósitos, " +
      "transferencias recibidas). Ignora débitos, cargos, comisiones y saldos. " +
      "Copia la descripción completa de cada movimiento, porque puede incluir el número de casa.",
    bloqueArchivo(datos, tipo),
    ESQUEMA_ESTADO,
  );
  return r?.movimientos ?? null;
}
