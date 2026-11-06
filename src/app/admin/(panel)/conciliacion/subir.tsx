"use client";

import { useActionState } from "react";
import { subirEstadoCuenta } from "../../acciones";

export function SubirEstadoCuenta() {
  const [r, accion, enviando] = useActionState(subirEstadoCuenta, null);
  return (
    <form action={accion} className="tarjeta space-y-4">
      <div>
        <h2 className="font-semibold">Subir estado de cuenta</h2>
        <p className="text-sm text-carbon-suave">
          Descárgalo de la banca en línea del conjunto. Recomendado: Excel (.xlsx) o CSV, que se
          leen con más precisión. También se acepta PDF.
        </p>
      </div>
      <input
        type="file"
        name="archivo"
        required
        accept=".xlsx,.csv,.pdf,.xls,.jpg,.jpeg,.png"
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-piedra-100 file:px-3 file:py-2"
      />
      <button className="boton" disabled={enviando}>
        {enviando ? "Leyendo y cruzando…" : "Subir y cruzar"}
      </button>
      {r?.error && <p className="rounded-lg bg-rojo-claro px-3 py-2 text-sm text-rojo">{r.error}</p>}
      {r && !r.error && (
        <p className="rounded-lg bg-verde-claro px-3 py-2 text-sm text-verde-oscuro">
          {r.archivo}: {r.leidos} depósitos leídos ({r.nuevos} nuevos
          {r.repetidos ? `, ${r.repetidos} ya estaban cargados` : ""}).{" "}
          <strong>{r.conciliados} pago(s) aprobados automáticamente.</strong>
        </p>
      )}
    </form>
  );
}
