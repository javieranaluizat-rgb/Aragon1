export const CONJUNTO = {
  nombre: process.env.CONJUNTO_NOMBRE || "Samara III",
  banco: process.env.CONJUNTO_BANCO || "",
  cuenta: process.env.CONJUNTO_CUENTA || "",
};

/** Tamaño máximo de un comprobante o estado de cuenta (bytes). */
export const MAX_ARCHIVO = 4 * 1024 * 1024;

export const TIPOS_COMPROBANTE = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
