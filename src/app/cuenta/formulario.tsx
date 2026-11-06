"use client";

import { useActionState } from "react";
import { cambiarClave } from "../sesion-acciones";

export function FormularioClave() {
  const [error, accion, enviando] = useActionState(cambiarClave, null);
  return (
    <form action={accion} className="tarjeta space-y-4">
      <h2 className="font-semibold">Cambiar contraseña</h2>
      <div>
        <label htmlFor="actual" className="etiqueta">Contraseña actual</label>
        <input id="actual" name="actual" type="password" className="campo" autoComplete="current-password" required />
      </div>
      <div>
        <label htmlFor="nueva" className="etiqueta">Nueva contraseña (mínimo 8 caracteres)</label>
        <input id="nueva" name="nueva" type="password" className="campo" autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label htmlFor="repetir" className="etiqueta">Repite la nueva contraseña</label>
        <input id="repetir" name="repetir" type="password" className="campo" autoComplete="new-password" minLength={8} required />
      </div>
      {error && <p className="text-sm text-rojo">{error}</p>}
      <button className="boton w-full" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
