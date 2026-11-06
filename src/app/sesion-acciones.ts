"use server";

import { redirect } from "next/navigation";
import {
  cerrarSesion,
  cifrarClave,
  comprobarCredenciales,
  iniciarSesion,
  sesion,
} from "@/lib/auth";
import { q, q1 } from "@/lib/db";

export async function ingresar(_prev: string | null, form: FormData) {
  const id = await comprobarCredenciales(
    String(form.get("usuario") ?? ""),
    String(form.get("clave") ?? ""),
  );
  if (id == null) {
    await new Promise((r) => setTimeout(r, 800));
    return "Usuario o contraseña incorrectos.";
  }
  await iniciarSesion(id);

  let destino = String(form.get("siguiente") ?? "");
  // Solo se permiten rutas internas para no redirigir a otro sitio.
  if (!destino.startsWith("/") || destino.startsWith("//")) destino = "";
  if (!destino) {
    const rol =
      id === 0 ? "admin" : (await q1<{ rol: string }>("SELECT rol FROM usuarios WHERE id = $1", [id]))?.rol;
    destino = rol === "admin" ? "/admin" : "/pagar";
  }
  redirect(destino);
}

export async function salir() {
  await cerrarSesion();
  redirect("/");
}

export async function cambiarClave(_prev: string | null, form: FormData) {
  const s = await sesion();
  if (!s) redirect("/ingresar");
  if (s.id === 0) {
    return "La cuenta principal usa la contraseña ADMIN_PASSWORD configurada en Vercel; se cambia allí.";
  }
  const actual = String(form.get("actual") ?? "");
  const nueva = String(form.get("nueva") ?? "");
  const repetir = String(form.get("repetir") ?? "");

  if ((await comprobarCredenciales(s.usuario, actual)) !== s.id) {
    return "La contraseña actual no es correcta.";
  }
  if (nueva.length < 8) return "La nueva contraseña debe tener al menos 8 caracteres.";
  if (nueva !== repetir) return "Las contraseñas nuevas no coinciden.";
  if (nueva === actual) return "La nueva contraseña debe ser distinta de la actual.";

  await q("UPDATE usuarios SET clave_hash = $2, debe_cambiar_clave = false WHERE id = $1", [
    s.id,
    await cifrarClave(nueva),
  ]);
  redirect(s.rol === "admin" ? "/admin" : "/pagar");
}
