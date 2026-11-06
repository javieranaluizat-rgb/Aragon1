import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "samara_admin";
const DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas

function secreto() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("Falta SESSION_SECRET o ADMIN_PASSWORD en la configuración.");
  return s;
}

function firmar(valor: string) {
  return createHmac("sha256", secreto()).update(valor).digest("hex");
}

function iguales(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function claveCorrecta(clave: string) {
  const esperada = process.env.ADMIN_PASSWORD;
  if (!esperada) return false;
  return iguales(firmar(clave), firmar(esperada));
}

export async function iniciarSesion() {
  const expira = String(Date.now() + DURACION_MS);
  const jar = await cookies();
  jar.set(COOKIE, `${expira}.${firmar(expira)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_MS / 1000,
  });
}

export async function cerrarSesion() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function esAdmin() {
  const jar = await cookies();
  const valor = jar.get(COOKIE)?.value;
  if (!valor) return false;
  const [expira, firma] = valor.split(".");
  if (!expira || !firma || !iguales(firma, firmar(expira))) return false;
  return Number(expira) > Date.now();
}

/** Para páginas y acciones del panel: redirige al login si no hay sesión. */
export async function exigirAdmin() {
  if (!(await esAdmin())) redirect("/admin/login");
}
