"use client";

import { useActionState } from "react";
import { editarUsuario, restablecerClave } from "../../../acciones";
import { Credencial } from "../credencial";

interface Props {
  usuario: {
    id: number;
    usuario: string;
    nombre: string;
    rol: "residente" | "admin";
    activo: boolean;
    casas: string | null;
  };
}

export function EditarUsuario({ usuario: u }: Props) {
  const [r, guardar, guardando] = useActionState(editarUsuario, null);
  const [c, restablecer, restableciendo] = useActionState(restablecerClave, null);

  return (
    <div className="space-y-4">
      <form action={guardar} className="tarjeta space-y-3">
        <input type="hidden" name="id" value={u.id} />
        <p className="text-sm text-carbon-suave">
          Usuario: <span className="font-mono">{u.usuario}</span>
        </p>
        <div>
          <label className="etiqueta" htmlFor="nombre">Nombre completo</label>
          <input id="nombre" name="nombre" className="campo" defaultValue={u.nombre} required />
        </div>
        <div>
          <label className="etiqueta" htmlFor="casas">Casa(s) asignadas</label>
          <input id="casas" name="casas" className="campo" defaultValue={u.casas ?? ""} placeholder="Ej. 12, 14" />
          <p className="mt-1 text-xs text-carbon-suave">
            Para reasignar, cambia los números. Deja vacío para quitarle todas las casas.
          </p>
        </div>
        <div>
          <label className="etiqueta" htmlFor="rol">Tipo</label>
          <select id="rol" name="rol" className="campo" defaultValue={u.rol}>
            <option value="residente">Residente</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked={u.activo} className="h-4 w-4 accent-verde" />
          Cuenta activa (desmárcalo para que ya no pueda entrar)
        </label>
        <button className="boton" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
        {r?.error && <p className="rounded-lg bg-rojo-claro px-3 py-2 text-sm text-rojo">{r.error}</p>}
        {r?.ok && <p className="rounded-lg bg-verde-claro px-3 py-2 text-sm text-verde-oscuro">{r.ok}</p>}
      </form>

      <form action={restablecer} className="tarjeta space-y-3">
        <input type="hidden" name="id" value={u.id} />
        <h2 className="font-semibold">¿Olvidó su contraseña?</h2>
        <p className="text-sm text-carbon-suave">
          Se genera una contraseña temporal nueva y la anterior deja de funcionar.
        </p>
        <button className="boton-sec" disabled={restableciendo}>
          {restableciendo ? "Generando…" : "Restablecer contraseña"}
        </button>
        {c?.error && <p className="text-sm text-rojo">{c.error}</p>}
        {c?.clave && c.usuario && <Credencial usuario={c.usuario} clave={c.clave} />}
      </form>
    </div>
  );
}
