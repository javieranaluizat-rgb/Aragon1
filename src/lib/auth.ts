import "server-only";
import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { q, q1 } from "./db";

/**
 * Inicio de sesión de residentes y administradores.
 *
 * - Cada persona tiene un usuario con contraseña, creado por un administrador.
 * - El usuario "admin" con la contraseña ADMIN_PASSWORD (variable de entorno)
 *   siempre puede entrar como administrador: sirve para el primer ingreso y
 *   para recuperar el acceso si se pierden las demás cuentas.
 */

const COOKIE = "samara_sesion";
const DURACION_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
const scryptAsync = promisify(scrypt) as (c: string, s: Buffer, l: number) => Promise<Buffer>;

export type Rol = "residente" | "admin";

export interface Sesion {
  id: number; // 0 = administrador de la variable ADMIN_PASSWORD
  usuario: string;
  nombre: string;
  rol: Rol;
  debeCambiarClave: boolean;
}

// --- Contraseñas -------------------------------------------------------------

export async function cifrarClave(clave: string) {
  const sal = randomBytes(16);
  const hash = await scryptAsync(clave, sal, 64);
  return `${sal.toString("hex")}:${hash.toString("hex")}`;
}

async function verificarClave(clave: string, guardado: string) {
  const [salHex, hashHex] = guardado.split(":");
  if (!salHex || !hashHex) return false;
  const hash = await scryptAsync(clave, Buffer.from(salHex, "hex"), 64);
  return timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

/** Contraseña temporal fácil de dictar (sin letras confusas como O/0, l/1). */
export function claveTemporal() {
  const letras = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += letras[randomInt(letras.length)];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

export function normalizarUsuario(u: unknown) {
  return String(u ?? "").trim().toLowerCase().slice(0, 80);
}

// --- Cookie firmada ----------------------------------------------------------

function secreto() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) throw new Error("Falta SESSION_SECRET en la configuración.");
  return s;
}

const firmar = (valor: string) => createHmac("sha256", secreto()).update(valor).digest("hex");

function iguales(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// --- Ingreso -----------------------------------------------------------------

/** Devuelve el id del usuario si las credenciales son correctas. */
export async function comprobarCredenciales(usuario: string, clave: string) {
  const u = normalizarUsuario(usuario);
  if (!u || !clave) return null;

  const claveEnv = process.env.ADMIN_PASSWORD;
  if (u === "admin" && claveEnv && iguales(firmar(clave), firmar(claveEnv))) return 0;

  const fila = await q1<{ id: number; clave_hash: string; activo: boolean }>(
    "SELECT id, clave_hash, activo FROM usuarios WHERE usuario = $1",
    [u],
  );
  if (!fila || !fila.activo) return null;
  if (!(await verificarClave(clave, fila.clave_hash))) return null;
  await q("UPDATE usuarios SET ultimo_ingreso = now() WHERE id = $1", [fila.id]);
  return fila.id;
}

export async function iniciarSesion(id: number) {
  const valor = `${id}.${Date.now() + DURACION_MS}`;
  const jar = await cookies();
  jar.set(COOKIE, `${valor}.${firmar(valor)}`, {
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

export async function sesion(): Promise<Sesion | null> {
  const jar = await cookies();
  const partes = jar.get(COOKIE)?.value?.split(".");
  if (!partes || partes.length !== 3) return null;
  const [id, expira, firma] = partes;
  if (!iguales(firma, firmar(`${id}.${expira}`)) || Number(expira) < Date.now()) return null;

  if (id === "0") {
    if (!process.env.ADMIN_PASSWORD) return null;
    return { id: 0, usuario: "admin", nombre: "Administrador", rol: "admin", debeCambiarClave: false };
  }
  // Se consulta la base en cada visita para que desactivar una cuenta tenga efecto inmediato.
  const u = await q1<{ id: number; usuario: string; nombre: string; rol: Rol; activo: boolean; debe_cambiar_clave: boolean }>(
    "SELECT id, usuario, nombre, rol, activo, debe_cambiar_clave FROM usuarios WHERE id = $1",
    [Number(id)],
  );
  if (!u || !u.activo) return null;
  return { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, debeCambiarClave: u.debe_cambiar_clave };
}

export async function esAdmin() {
  return (await sesion())?.rol === "admin";
}

/** Para páginas de residentes: exige sesión y, si toca, el cambio de contraseña. */
export async function exigirUsuario(desde = "/") {
  const s = await sesion();
  if (!s) redirect(`/ingresar?siguiente=${encodeURIComponent(desde)}`);
  if (s.debeCambiarClave) redirect("/cuenta");
  return s;
}

export async function exigirAdmin() {
  const s = await sesion();
  if (!s) redirect("/ingresar?siguiente=/admin");
  if (s.debeCambiarClave) redirect("/cuenta");
  if (s.rol !== "admin") redirect("/");
  return s;
}

// --- Casas del usuario -------------------------------------------------------

export interface CasaDeUsuario {
  id: number;
  numero: string;
  alicuota: number;
}

/** Casas en las que el usuario puede registrar pagos (los admins, todas). */
export async function casasDe(s: Sesion): Promise<CasaDeUsuario[]> {
  const orden = "ORDER BY CASE WHEN c.numero ~ '^[0-9]+$' THEN c.numero::int END, c.numero";
  if (s.rol === "admin") {
    return q<CasaDeUsuario>(`SELECT c.id, c.numero, c.alicuota::float8 AS alicuota FROM casas c ${orden}`);
  }
  return q<CasaDeUsuario>(
    `SELECT c.id, c.numero, c.alicuota::float8 AS alicuota
     FROM casas c JOIN usuario_casas uc ON uc.casa_id = c.id
     WHERE uc.usuario_id = $1 ${orden}`,
    [s.id],
  );
}

/** Verifica que la casa pertenezca al usuario y la devuelve. */
export async function casaPermitida(s: Sesion, casaId: unknown) {
  const id = Number(casaId);
  if (!Number.isInteger(id) || id <= 0) return undefined;
  return (await casasDe(s)).find((c) => c.id === id);
}
