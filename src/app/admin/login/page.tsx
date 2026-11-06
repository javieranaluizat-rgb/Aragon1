"use client";

import { useActionState } from "react";
import { entrar } from "../acciones";

export default function Login() {
  const [error, accion, enviando] = useActionState(entrar, null);
  return (
    <form action={accion} className="tarjeta mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Administración</h1>
      <div>
        <label htmlFor="clave" className="etiqueta">Contraseña</label>
        <input id="clave" name="clave" type="password" className="campo" required autoFocus />
      </div>
      {error && <p className="text-sm text-rojo">{error}</p>}
      <button className="boton w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
