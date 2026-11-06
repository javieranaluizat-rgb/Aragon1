"use server";

import { revalidatePath } from "next/cache";
import { cifrarClave, claveTemporal, exigirAdmin, normalizarUsuario } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { normalizarCasa } from "@/lib/casas";
import { aNumero, leerEstadoCuentaTabla } from "@/lib/estado-cuenta";
import { iaDisponible, leerEstadoCuentaDocumento } from "@/lib/ai";
import { aplicarCruce, conciliarAutomaticamente, guardarMovimientos } from "@/lib/conciliacion";
import { MAX_ARCHIVO } from "@/lib/config";

// --- Pagos -----------------------------------------------------------------

export async function aprobarManual(form: FormData) {
  await exigirAdmin();
  await q(
    `UPDATE pagos SET estado = 'conciliado', forma_verificacion = 'manual',
       nota_admin = $2, verificado = now()
     WHERE id = $1 AND estado = 'pendiente'`,
    [Number(form.get("id")), String(form.get("nota") ?? "").trim() || null],
  );
  revalidatePath("/admin", "layout");
}

export async function rechazar(form: FormData) {
  await exigirAdmin();
  const nota = String(form.get("nota") ?? "").trim();
  await q(
    `UPDATE pagos SET estado = 'rechazado', movimiento_id = NULL, nota_admin = $2, verificado = now()
     WHERE id = $1 AND estado = 'pendiente'`,
    [Number(form.get("id")), nota || "El pago no aparece en el estado de cuenta del conjunto."],
  );
  revalidatePath("/admin", "layout");
}

export async function devolverAPendiente(form: FormData) {
  await exigirAdmin();
  await q(
    `UPDATE pagos SET estado = 'pendiente', movimiento_id = NULL, forma_verificacion = NULL,
       verificado = NULL WHERE id = $1`,
    [Number(form.get("id"))],
  );
  revalidatePath("/admin", "layout");
}

export async function confirmarCruce(form: FormData) {
  await exigirAdmin();
  await aplicarCruce(Number(form.get("pago")), Number(form.get("movimiento")), "manual");
  revalidatePath("/admin", "layout");
}

// --- Estado de cuenta ------------------------------------------------------

export interface ResultadoCarga {
  error?: string;
  archivo?: string;
  leidos?: number;
  nuevos?: number;
  repetidos?: number;
  conciliados?: number;
}

export async function subirEstadoCuenta(
  _prev: ResultadoCarga | null,
  form: FormData,
): Promise<ResultadoCarga> {
  await exigirAdmin();
  const archivo = form.get("archivo");
  if (!archivo || typeof archivo === "string" || archivo.size === 0) {
    return { error: "Elige el archivo del estado de cuenta." };
  }
  if (archivo.size > MAX_ARCHIVO) {
    return { error: "El archivo pesa más de 4 MB." };
  }
  const nombre = archivo.name;
  const ext = nombre.toLowerCase().split(".").pop() ?? "";
  const datos = Buffer.from(await archivo.arrayBuffer());

  let movimientos;
  try {
    if (ext === "xlsx" || ext === "csv") {
      movimientos = await leerEstadoCuentaTabla(datos, nombre);
    } else if (ext === "xls") {
      return {
        error:
          "Los archivos .xls antiguos no se pueden leer. Ábrelo en Excel y guárdalo como .xlsx o .csv, o sube el PDF.",
      };
    } else if (["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      if (!iaDisponible()) {
        return {
          error:
            "Para leer estados de cuenta en PDF o foto hace falta configurar la clave de Claude. Mientras tanto, sube el Excel o CSV del banco.",
        };
      }
      const tipo =
        ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
      movimientos = await leerEstadoCuentaDocumento(datos, tipo);
      if (!movimientos) return { error: "No se pudo leer el documento. Prueba con el Excel o CSV." };
    } else {
      return { error: "Formato no reconocido. Sube el estado de cuenta en Excel (.xlsx), CSV o PDF." };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }

  if (movimientos.length === 0) {
    return { error: "No encontré depósitos ni transferencias recibidas en ese archivo." };
  }

  const r = await guardarMovimientos(nombre, movimientos);
  const conciliados = await conciliarAutomaticamente();
  revalidatePath("/admin", "layout");
  return { archivo: nombre, leidos: r.leidos, nuevos: r.nuevos, repetidos: r.repetidos, conciliados };
}

export async function volverACruzar() {
  await exigirAdmin();
  await conciliarAutomaticamente();
  revalidatePath("/admin", "layout");
}

// --- Casas -----------------------------------------------------------------

export async function guardarCasa(form: FormData) {
  await exigirAdmin();
  const numero = normalizarCasa(form.get("numero"));
  if (!numero) return;
  const propietario = String(form.get("propietario") ?? "").trim() || null;
  const email = String(form.get("email") ?? "").trim() || null;
  const alicuota = aNumero(String(form.get("alicuota") ?? "")) ?? 0;
  await q(
    `INSERT INTO casas (numero, propietario, email, alicuota) VALUES ($1, $2, $3, $4)
     ON CONFLICT (numero) DO UPDATE
       SET propietario = EXCLUDED.propietario, email = EXCLUDED.email, alicuota = EXCLUDED.alicuota`,
    [numero, propietario, email, alicuota],
  );
  revalidatePath("/admin/casas");
}

export async function crearRango(form: FormData) {
  await exigirAdmin();
  const desde = Math.max(1, Number(form.get("desde")) || 1);
  const hasta = Math.min(desde + 999, Number(form.get("hasta")) || desde);
  const alicuota = aNumero(String(form.get("alicuota") ?? "")) ?? 0;
  for (let n = desde; n <= hasta; n++) {
    await q(
      "INSERT INTO casas (numero, alicuota) VALUES ($1, $2) ON CONFLICT (numero) DO NOTHING",
      [String(n), alicuota],
    );
  }
  revalidatePath("/admin/casas");
}

export async function eliminarCasa(form: FormData) {
  await exigirAdmin();
  // Solo se puede eliminar una casa sin pagos registrados.
  await q(
    "DELETE FROM casas WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM pagos WHERE casa_id = $1)",
    [Number(form.get("id"))],
  );
  revalidatePath("/admin/casas");
}

export async function cambiarAlicuota(form: FormData) {
  await exigirAdmin();
  const alicuota = aNumero(String(form.get("alicuota") ?? ""));
  if (alicuota == null || alicuota < 0) return;
  await q("UPDATE casas SET alicuota = $2 WHERE id = $1", [Number(form.get("id")), alicuota]);
  revalidatePath("/admin/casas");
}

export async function alicuotaParaTodas(form: FormData) {
  await exigirAdmin();
  const alicuota = aNumero(String(form.get("alicuota") ?? ""));
  if (alicuota == null || alicuota < 0) return;
  await q("UPDATE casas SET alicuota = $1", [alicuota]);
  revalidatePath("/admin/casas");
}

// --- Usuarios --------------------------------------------------------------

export interface ResultadoUsuario {
  error?: string;
  ok?: string;
  usuario?: string;
  clave?: string;
}

/** "12, 14 y 3" -> ids de esas casas; devuelve también los números que no existen. */
async function idsDeCasas(texto: string) {
  const numeros = [...new Set(String(texto).replace(/\by\b/gi, ",").split(/[\s,;]+/).map(normalizarCasa).filter(Boolean))];
  if (numeros.length === 0) return { ids: [] as number[], faltan: [] as string[] };
  const filas = await q<{ id: number; numero: string }>(
    "SELECT id, upper(numero) AS numero FROM casas WHERE upper(numero) = ANY($1::text[])",
    [numeros],
  );
  const encontrados = new Set(filas.map((f) => f.numero));
  return { ids: filas.map((f) => f.id), faltan: numeros.filter((n) => !encontrados.has(n)) };
}

async function asignarCasas(usuarioId: number, ids: number[]) {
  await q("DELETE FROM usuario_casas WHERE usuario_id = $1", [usuarioId]);
  for (const casaId of ids) {
    await q(
      "INSERT INTO usuario_casas (usuario_id, casa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [usuarioId, casaId],
    );
  }
}

const rolValido = (v: FormDataEntryValue | null) => (v === "admin" ? "admin" : "residente");

export async function crearUsuario(
  _prev: ResultadoUsuario | null,
  form: FormData,
): Promise<ResultadoUsuario> {
  await exigirAdmin();
  const usuario = normalizarUsuario(form.get("usuario"));
  const nombre = String(form.get("nombre") ?? "").trim().slice(0, 120);
  if (!nombre) return { error: "Escribe el nombre de la persona." };
  if (!/^[a-z0-9._@-]{3,}$/.test(usuario)) {
    return { error: "El usuario debe tener al menos 3 caracteres: letras, números, punto, guion o @ (sin espacios)." };
  }
  if (usuario === "admin") return { error: "El usuario «admin» está reservado." };
  if (await q1("SELECT 1 FROM usuarios WHERE usuario = $1", [usuario])) {
    return { error: `Ya existe el usuario «${usuario}».` };
  }
  const { ids, faltan } = await idsDeCasas(String(form.get("casas") ?? ""));
  if (faltan.length) return { error: `Estas casas no existen: ${faltan.join(", ")}. Créalas primero en «Casas».` };

  const clave = claveTemporal();
  const nuevo = await q1<{ id: number }>(
    `INSERT INTO usuarios (usuario, nombre, clave_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id`,
    [usuario, nombre, await cifrarClave(clave), rolValido(form.get("rol"))],
  );
  await asignarCasas(nuevo!.id, ids);
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/casas");
  return { ok: `Usuario creado para ${nombre}.`, usuario, clave };
}

export async function editarUsuario(
  _prev: ResultadoUsuario | null,
  form: FormData,
): Promise<ResultadoUsuario> {
  const yo = await exigirAdmin();
  const id = Number(form.get("id"));
  const nombre = String(form.get("nombre") ?? "").trim().slice(0, 120);
  if (!nombre) return { error: "Escribe el nombre de la persona." };
  const rol = rolValido(form.get("rol"));
  const activo = form.get("activo") === "on";
  if (id === yo.id && (!activo || rol !== "admin")) {
    return { error: "No puedes quitarte a ti mismo el acceso de administrador." };
  }
  const { ids, faltan } = await idsDeCasas(String(form.get("casas") ?? ""));
  if (faltan.length) return { error: `Estas casas no existen: ${faltan.join(", ")}.` };

  await q("UPDATE usuarios SET nombre = $2, rol = $3, activo = $4 WHERE id = $1", [id, nombre, rol, activo]);
  await asignarCasas(id, ids);
  revalidatePath("/admin", "layout");
  return { ok: "Cambios guardados." };
}

export async function restablecerClave(
  _prev: ResultadoUsuario | null,
  form: FormData,
): Promise<ResultadoUsuario> {
  await exigirAdmin();
  const id = Number(form.get("id"));
  const u = await q1<{ usuario: string }>("SELECT usuario FROM usuarios WHERE id = $1", [id]);
  if (!u) return { error: "El usuario no existe." };
  const clave = claveTemporal();
  await q("UPDATE usuarios SET clave_hash = $2, debe_cambiar_clave = true WHERE id = $1", [
    id,
    await cifrarClave(clave),
  ]);
  return { ok: "Contraseña restablecida.", usuario: u.usuario, clave };
}
