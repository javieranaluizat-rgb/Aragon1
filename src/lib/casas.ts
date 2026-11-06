import "server-only";
import { q1 } from "./db";

/** "Casa 012" -> "12", " 7b " -> "7B" */
export function normalizarCasa(valor: unknown) {
  let s = String(valor ?? "").trim().toUpperCase();
  s = s.replace(/^(CASA|CS|LOTE|VILLA|DPTO|DEPTO|UNIDAD)\s*[.#:-]?\s*/i, "");
  s = s.replace(/^0+(?=\d)/, "");
  return s.slice(0, 20);
}

export interface Casa {
  id: number;
  numero: string;
  propietario: string | null;
  alicuota: number;
}

export async function buscarCasa(numero: unknown) {
  const n = normalizarCasa(numero);
  if (!n) return undefined;
  return q1<Casa>(
    "SELECT id, numero, propietario, alicuota::float8 AS alicuota FROM casas WHERE upper(numero) = $1",
    [n],
  );
}
