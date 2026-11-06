"use client";

import { useActionState } from "react";
import { crearUsuario } from "../../acciones";
import { Credencial } from "./credencial";

export function NuevoUsuario() {
  const [r, accion, enviando] = useActionState(crearUsuario, null);
  return (
    <form action={accion} className="tarjeta space-y-3" key={r?.clave ?? "nuevo"}>
      <h2 className="font-semibold">Crear usuario</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="nombre">Nombre completo</label>
          <input id="nombre" name="nombre" className="campo" required />
        </div>
        <div>
          <label className="etiqueta" htmlFor="usuario">Usuario (cédula o correo)</label>
          <input id="usuario" name="usuario" className="campo" autoCapitalize="none" required />
        </div>
        <div>
          <label className="etiqueta" htmlFor="casas">Casa(s)</label>
          <input id="casas" name="casas" className="campo" placeholder="Ej. 12   o   12, 14" />
        </div>
        <div>
          <label className="etiqueta" htmlFor="rol">Tipo</label>
          <select id="rol" name="rol" className="campo" defaultValue="residente">
            <option value="residente">Residente</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>
      <button className="boton" disabled={enviando}>
        {enviando ? "Creando…" : "Crear usuario"}
      </button>
      {r?.error && <p className="rounded-lg bg-rojo-claro px-3 py-2 text-sm text-rojo">{r.error}</p>}
      {r?.clave && r.usuario && <Credencial usuario={r.usuario} clave={r.clave} />}
    </form>
  );
}
