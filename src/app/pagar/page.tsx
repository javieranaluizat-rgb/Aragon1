import { casasDe, exigirUsuario } from "@/lib/auth";
import { FormularioPago } from "./formulario";

export const metadata = { title: "Subir comprobante" };
export const dynamic = "force-dynamic";

export default async function PaginaPagar() {
  const s = await exigirUsuario("/pagar");
  const casas = await casasDe(s);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold">Subir comprobante de pago</h1>
      <p className="mb-6 text-carbon-suave">
        {s.rol === "admin"
          ? "Como administrador puedes registrar un pago para cualquier casa."
          : `Hola, ${s.nombre.split(" ")[0]}. Sube la foto o el PDF de tu comprobante.`}
      </p>
      {casas.length === 0 ? (
        <p className="tarjeta text-sm">
          Tu usuario todavía no tiene casas asignadas. Pide a la administración que te asigne tu casa.
        </p>
      ) : (
        <FormularioPago casas={casas} />
      )}
    </div>
  );
}
