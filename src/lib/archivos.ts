import "server-only";
import { MAX_ARCHIVO, TIPOS_COMPROBANTE } from "./config";

/** Valida y lee un comprobante subido en un FormData. */
export async function leerArchivoComprobante(valor: FormDataEntryValue | null) {
  if (!valor || typeof valor === "string") {
    return { error: "No llegó ningún archivo." } as const;
  }
  if (valor.size === 0) return { error: "El archivo está vacío." } as const;
  if (valor.size > MAX_ARCHIVO) {
    return { error: "El archivo pesa más de 4 MB. Toma la foto de nuevo o sube el PDF." } as const;
  }
  const datos = Buffer.from(await valor.arrayBuffer());
  const tipo = detectarTipo(datos) ?? valor.type;
  if (!TIPOS_COMPROBANTE.includes(tipo)) {
    return { error: "Formato no permitido. Sube una foto (JPG o PNG) o un PDF." } as const;
  }
  return { datos, tipo, nombre: valor.name || "comprobante" } as const;
}

/** Reconoce el tipo real por los primeros bytes, sin confiar en el navegador. */
function detectarTipo(b: Buffer) {
  if (b.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
  if (b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}
