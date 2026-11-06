"use client";

import { useActionState } from "react";
import { ingresar } from "../sesion-acciones";

export function FormularioIngreso({ siguiente }: { siguiente: string }) {
  const [error, accion, enviando] = useActionState(ingresar, null);
  return (
    <form action={accion} className="tarjeta mx-auto max-w-sm space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Ingresar</h1>
        <p className="text-sm text-carbon-suave">
          Usa el usuario y la contraseña que te entregó la administración.
        </p>
      </div>
      <input type="hidden" name="siguiente" value={siguiente} />
      <div>
        <label htmlFor="usuario" className="etiqueta">Usuario</label>
        <input
          id="usuario"
          name="usuario"
          className="campo"
          autoComplete="username"
          autoCapitalize="none"
          required
          autoFocus
        />
      </div>
      <div>
        <label htmlFor="clave" className="etiqueta">Contraseña</label>
        <input id="clave" name="clave" type="password" className="campo" autoComplete="current-password" required />
      </div>
      {error && <p className="text-sm text-rojo">{error}</p>}
      <button className="boton w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-xs text-carbon-suave">
        ¿Olvidaste tu contraseña? Pide a la administración que te asigne una nueva.
      </p>
    </form>
  );
}
