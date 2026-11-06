"use client";

import { useState } from "react";

/** Muestra el usuario y la contraseña temporal para entregarlos al residente. */
export function Credencial({ usuario, clave }: { usuario: string; clave: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Tu acceso a la app de pagos del conjunto:\nUsuario: ${usuario}\nContraseña temporal: ${clave}\nAl entrar te pedirá crear tu propia contraseña.`;
  return (
    <div className="space-y-2 rounded-lg bg-verde-claro px-4 py-3 text-sm text-verde-oscuro">
      <p>
        Usuario: <strong className="font-mono">{usuario}</strong>
        <br />
        Contraseña temporal: <strong className="font-mono">{clave}</strong>
      </p>
      <p className="text-xs">
        Entrégasela a la persona. Solo se muestra esta vez; al entrar, la app le pedirá crear su propia contraseña.
      </p>
      <button
        type="button"
        className="boton-sec py-1 text-xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
          } catch {
            setCopiado(false);
          }
        }}
      >
        {copiado ? "Copiado ✓" : "Copiar mensaje para enviar"}
      </button>
    </div>
  );
}
