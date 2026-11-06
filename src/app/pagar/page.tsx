import { FormularioPago } from "./formulario";

export const metadata = { title: "Subir comprobante" };

export default function PaginaPagar() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold">Subir comprobante de pago</h1>
      <p className="mb-6 text-carbon-suave">
        Solo necesitas el número de tu casa y el comprobante.
      </p>
      <FormularioPago />
    </div>
  );
}
