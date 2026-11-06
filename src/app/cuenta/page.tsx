import { redirect } from "next/navigation";
import { casasDe, sesion } from "@/lib/auth";
import { FormularioClave } from "./formulario";

export const metadata = { title: "Mi cuenta" };

export default async function Cuenta() {
  const s = await sesion();
  if (!s) redirect("/ingresar?siguiente=/cuenta");
  const casas = s.rol === "admin" ? [] : await casasDe(s);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mi cuenta</h1>
        <p className="text-carbon-suave">
          {s.nombre} · usuario <strong>{s.usuario}</strong>
          {casas.length > 0 && <> · Casa{casas.length > 1 ? "s" : ""} {casas.map((c) => c.numero).join(", ")}</>}
        </p>
      </div>
      {s.debeCambiarClave && (
        <p className="rounded-lg bg-ambar-claro px-4 py-3 text-sm text-ambar">
          Estás usando una contraseña temporal. Crea tu propia contraseña para continuar.
        </p>
      )}
      <FormularioClave />
    </div>
  );
}
