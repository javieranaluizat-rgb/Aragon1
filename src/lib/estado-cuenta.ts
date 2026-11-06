import "server-only";
import Papa from "papaparse";
import type { MovimientoLeido } from "./ai";

/**
 * Lee un estado de cuenta en Excel (.xlsx) o CSV y devuelve solo los
 * movimientos de crédito (dinero que entra a la cuenta del conjunto).
 * Reconoce las columnas por su encabezado, así que funciona con los formatos
 * de la mayoría de bancos sin configurar nada.
 */

type Celda = string | number | Date | null;

export async function leerEstadoCuentaTabla(
  datos: Buffer,
  nombre: string,
): Promise<MovimientoLeido[]> {
  const filas = nombre.toLowerCase().endsWith(".csv")
    ? leerCsv(datos)
    : await leerXlsx(datos);
  return interpretarFilas(filas);
}

function leerCsv(datos: Buffer): Celda[][] {
  let texto = datos.toString("utf8");
  if (texto.includes("�")) texto = datos.toString("latin1");
  const r = Papa.parse<string[]>(texto.replace(/^﻿/, ""), {
    skipEmptyLines: true,
  });
  return r.data;
}

async function leerXlsx(datos: Buffer): Promise<Celda[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(datos as unknown as ArrayBuffer);
  const hoja = libro.worksheets[0];
  if (!hoja) return [];
  const filas: Celda[][] = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const valores: Celda[] = [];
    fila.eachCell({ includeEmpty: true }, (celda, col) => {
      let v: unknown = celda.value;
      if (v && typeof v === "object" && !(v instanceof Date)) {
        const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
        v = o.result ?? o.text ?? o.richText?.map((t) => t.text).join("") ?? null;
      }
      valores[col - 1] = (v as Celda) ?? null;
    });
    filas.push(valores);
  });
  return filas;
}

const PATRONES = {
  fecha: /fecha/i,
  credito: /cr[eé]dito|abono|dep[oó]sito|ingreso/i,
  debito: /d[eé]bito|cargo|retiro|egreso/i,
  monto: /monto|valor|importe|cantidad/i,
  tipo: /^tipo$|^d\/c$|^c\/d$|signo|naturaleza/i,
  referencia: /documento|referencia|comprobante|n[uú]mero|secuencial|^ref/i,
  descripcion: /concepto|descripci|detalle|transacci|movimiento|glosa|observaci/i,
  saldo: /saldo/i,
};

function normal(v: Celda) {
  return v == null ? "" : String(v).trim();
}

function interpretarFilas(filas: Celda[][]): MovimientoLeido[] {
  // 1. Encontrar la fila de encabezados.
  let iEnc = -1;
  for (let i = 0; i < Math.min(filas.length, 40); i++) {
    const textos = filas[i].map(normal);
    const tieneFecha = textos.some((t) => PATRONES.fecha.test(t));
    const tieneValor = textos.some(
      (t) => PATRONES.credito.test(t) || PATRONES.monto.test(t),
    );
    if (tieneFecha && tieneValor) {
      iEnc = i;
      break;
    }
  }
  if (iEnc === -1) {
    throw new Error(
      "No encontré los encabezados del estado de cuenta (se necesita al menos una columna de Fecha y una de Crédito, Monto o Valor).",
    );
  }

  const enc = filas[iEnc].map(normal);
  const col = (re: RegExp, excluir: number[] = []) =>
    enc.findIndex((t, i) => !excluir.includes(i) && re.test(t));

  const cFecha = col(PATRONES.fecha);
  const cSaldo = col(PATRONES.saldo);
  const cCredito = col(PATRONES.credito, [cSaldo]);
  const cDebito = col(PATRONES.debito, [cSaldo, cCredito]);
  const cMonto = cCredito === -1 ? col(PATRONES.monto, [cSaldo]) : -1;
  const cTipo = col(PATRONES.tipo);
  const cRef = col(PATRONES.referencia, [cFecha]);
  const cDesc = col(PATRONES.descripcion, [cRef, cTipo]);

  const movimientos: MovimientoLeido[] = [];
  for (const fila of filas.slice(iEnc + 1)) {
    const fecha = aFecha(fila[cFecha]);
    if (!fecha) continue; // filas de totales, saldos, etc.

    let monto: number | null = null;
    if (cCredito !== -1) {
      monto = aNumero(fila[cCredito]);
    } else if (cMonto !== -1) {
      monto = aNumero(fila[cMonto]);
      const tipo = cTipo !== -1 ? normal(fila[cTipo]).toLowerCase() : "";
      if (tipo && /^(d|db|deb|nd|-)|d[eé]bito|cargo/.test(tipo)) monto = null;
      if (cDebito !== -1 && aNumero(fila[cDebito])) monto = null;
    }
    if (monto == null || monto <= 0) continue;

    movimientos.push({
      fecha,
      monto: Math.round(monto * 100) / 100,
      referencia: cRef !== -1 ? normal(fila[cRef]) || null : null,
      descripcion: cDesc !== -1 ? normal(fila[cDesc]) || null : null,
    });
  }
  return movimientos;
}

export function aNumero(v: Celda): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  let s = String(v).replace(/[^\d,.\-]/g, "");
  if (!s) return null;
  const ultimaComa = s.lastIndexOf(",");
  const ultimoPunto = s.lastIndexOf(".");
  if (ultimaComa > ultimoPunto) {
    // 1.234,56  ->  1234.56
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // 1,234.56  ->  1234.56
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function aFecha(v: Celda): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    // Número de serie de Excel (días desde 1899-12-30).
    if (v < 20000 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return armar(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const anio = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return armar(anio, +m[2], +m[1]); // En Ecuador se usa día/mes/año.
  }
  m = s.match(/^(\d{1,2})[-\s/]([a-záéíóú]{3,})[-\s/](\d{2,4})/i);
  if (m) {
    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const mes = meses.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    const anio = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (mes > 0) return armar(anio, mes, +m[1]);
  }
  return null;
}

function armar(a: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
