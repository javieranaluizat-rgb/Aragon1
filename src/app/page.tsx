import Link from "next/link";
import Image from "next/image";
import { CONJUNTO } from "@/lib/config";
import { sesion } from "@/lib/auth";

export default async function Inicio() {
  const s = await sesion();
  return (
    <div className="space-y-8">
      <section className="grid items-center gap-6 rounded-3xl bg-piedra-100 p-6 sm:grid-cols-[1fr_auto] sm:p-10">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-widest text-verde">
            Conjunto {CONJUNTO.nombre}
          </p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Registra el pago de tu alícuota en un minuto
          </h1>
          <p className="max-w-xl text-carbon-suave">
            Ingresa con tu usuario y sube la foto o el PDF del comprobante. La
            administración lo verifica con el estado de cuenta del banco y te confirma.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {s ? (
              <>
                <Link href="/pagar" className="boton">Subir comprobante</Link>
                <Link href="/mis-pagos" className="boton-sec">Ver mis pagos</Link>
              </>
            ) : (
              <Link href="/ingresar" className="boton">Ingresar</Link>
            )}
          </div>
        </div>
        <Image
          src="/samara.png"
          alt={`Letrero del conjunto ${CONJUNTO.nombre}`}
          width={189}
          height={122}
          className="hidden rounded-2xl shadow-md sm:block"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["1", "Transfiere", "Paga la alícuota a la cuenta del conjunto. Escribe “Casa” y tu número en la descripción de la transferencia."],
          ["2", "Sube el comprobante", "Ingresa con tu usuario. La app lee el monto, la fecha y el número de comprobante; tú solo revisas."],
          ["3", "Te confirmamos", "Cuando el pago aparece en el banco, queda aprobado y lo ves en “Mis pagos”."],
        ].map(([n, t, d]) => (
          <div key={n} className="tarjeta">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-verde-claro font-semibold text-verde">
              {n}
            </div>
            <h2 className="font-semibold">{t}</h2>
            <p className="mt-1 text-sm text-carbon-suave">{d}</p>
          </div>
        ))}
      </section>

      {CONJUNTO.cuenta && (
        <section className="tarjeta text-sm">
          <h2 className="mb-1 font-semibold">Cuenta del conjunto</h2>
          <p className="text-carbon-suave">
            {CONJUNTO.banco} · Cuenta {CONJUNTO.cuenta} · A nombre de {CONJUNTO.nombre}
          </p>
        </section>
      )}
    </div>
  );
}
