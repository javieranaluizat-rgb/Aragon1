"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cerrarSesion, claveCorrecta, exigirAdmin, iniciarSesion } from "@/lib/auth";
import { q } from "@/lib/db";
import { normalizarCasa } from "@/lib/casas";
import { aNumero } from "@/lib/estado-cuenta";
import { leerEstadoCuentaTabla } from "@/lib/estado-cuenta";
import { iaDisponible, leerEstadoCuentaDocumento } from "@/lib/ai";
import { aplicarCruce, conciliarAutomaticamente, guardarMovimientos } from "@/lib/conciliacion";
import { MAX_ARCHIVO } from "@/lib/config";

// --- Sesión ----------------------------------------------------------------

export async function entrar(_prev: string | null, form: FormData) {
  if (!process.env.ADMIN_PASSWORD) {
    return "Falta configurar ADMIN_PASSWORD en el servidor.";
  }
  if (!claveCorrecta(String(form.get("clave") ?? ""))) {
    await new Promise((r) => setTimeout(r, 800));
    return "Contraseña incorrecta.";
  }
  await iniciarSesion();
  redirect("/admin");
}

export async function salir() {
  await cerrarSesion();
  redirect("/");
}

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
