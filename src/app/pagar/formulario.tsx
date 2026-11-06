"use client";

import { useId, useState } from "react";
import Link from "next/link";

type Paso = "casa" | "archivo" | "revisar" | "listo";

interface Aviso {
  tipo: "error" | "alerta" | "info";
  texto: string;
}

interface Lectura {
  banco: string | null;
  monto: number | null;
  fecha: string | null;
  referencia: string | null;
  ordenante: string | null;
  cuenta_destino: string | null;
}

const MAX_BYTES = 4 * 1024 * 1024;
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
  "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Reduce la foto a un tamaño razonable para subirla rápido. */
async function prepararImagen(archivo: File): Promise<{ archivo: File; ancho: number; alto: number }> {
  const bitmap = await createImageBitmap(archivo);
  const { width, height } = bitmap;
  const lado = 2000;
  const escala = Math.min(1, lado / Math.max(width, height));
  if (escala === 1 && archivo.size < 1.5 * 1024 * 1024) {
    bitmap.close();
    return { archivo, ancho: width, alto: height };
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * escala);
  canvas.height = Math.round(height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la foto"))), "image/jpeg", 0.88),
  );
  return {
    archivo: new File([blob], archivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }),
    ancho: width,
    alto: height,
  };
}

export function FormularioPago() {
  const [paso, setPaso] = useState<Paso>("casa");
  const [casa, setCasa] = useState("");
  const [alicuota, setAlicuota] = useState<number | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const hoy = new Date();
  const [datos, setDatos] = useState({
    monto: "",
    fecha: "",
    banco: "",
    referencia: "",
    ordenante: "",
    cuenta_destino: "",
    concepto: `Alícuota ${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`,
  });

  async function confirmarCasa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const r = await fetch(`/api/casa?numero=${encodeURIComponent(casa)}`);
      const j = await r.json();
      if (!j.existe) {
        setError("No encontramos esa casa. Revisa el número o consulta con la administración.");
        return;
      }
      setCasa(j.numero);
      setAlicuota(j.alicuota);
      setPaso("archivo");
    } catch {
      setError("No hay conexión. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0];
    e.target.value = "";
    if (!elegido) return;
    setError(null);
    setAvisos([]);

    let final = elegido;
    if (elegido.type.startsWith("image/")) {
      try {
        const r = await prepararImagen(elegido);
        if (Math.max(r.ancho, r.alto) < 700) {
          setError(
            "La foto es muy pequeña y no se leerá bien. Tómala más de cerca o sube la captura original del banco.",
          );
          return;
        }
        final = r.archivo;
      } catch {
        setError("No pudimos abrir esa foto. Prueba con otra o sube el PDF.");
        return;
      }
    } else if (elegido.type !== "application/pdf") {
      setError("Sube una foto (JPG o PNG) o un PDF.");
      return;
    }
    if (final.size > MAX_BYTES) {
      setError("El archivo pesa más de 4 MB. Sube el PDF o una captura de pantalla.");
      return;
    }

    if (vista) URL.revokeObjectURL(vista);
    setArchivo(final);
    setVista(final.type.startsWith("image/") ? URL.createObjectURL(final) : null);
    await leer(final);
  }

  async function leer(f: File) {
    setCargando(true);
    try {
      const fd = new FormData();
      fd.set("casa", casa);
      fd.set("archivo", f);
      const r = await fetch("/api/comprobante/leer", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "No se pudo leer el archivo.");
        return;
      }
      const l: Lectura | null = j.lectura;
      setLectura(l);
      setAvisos(j.avisos ?? []);
      setDatos((d) => ({
        ...d,
        monto: l?.monto != null ? l.monto.toFixed(2) : "",
        fecha: l?.fecha ?? "",
        banco: l?.banco ?? "",
        referencia: l?.referencia ?? "",
        ordenante: l?.ordenante ?? "",
        cuenta_destino: l?.cuenta_destino ?? "",
      }));
      setPaso("revisar");
    } catch {
      setError("No hay conexión. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo) return;
    setError(null);
    setCargando(true);
    try {
      const fd = new FormData();
      fd.set("casa", casa);
      fd.set("archivo", archivo);
      for (const [k, v] of Object.entries(datos)) fd.set(k, v);
      if (lectura) fd.set("lectura", JSON.stringify(lectura));
      const r = await fetch("/api/pagos", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "No se pudo registrar el pago.");
        return;
      }
      setPaso("listo");
    } catch {
      setError("No hay conexión. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  function reiniciar() {
    if (vista) URL.revokeObjectURL(vista);
    setArchivo(null);
    setVista(null);
    setLectura(null);
    setAvisos([]);
    setError(null);
    setPaso("archivo");
  }

  const bloqueado = avisos.some((a) => a.tipo === "error");

  return (
    <div className="space-y-4">
      <Pasos actual={paso} />

      {error && (
        <div role="alert" className="rounded-lg bg-rojo-claro px-4 py-3 text-sm text-rojo">
          {error}
        </div>
      )}

      {paso === "casa" && (
        <form onSubmit={confirmarCasa} className="tarjeta space-y-4">
          <div>
            <label htmlFor="casa" className="etiqueta">Número de casa</label>
            <input
              id="casa"
              className="campo text-2xl font-semibold tracking-wider"
              inputMode="text"
              autoComplete="off"
              placeholder="Ej. 12"
              value={casa}
              onChange={(e) => setCasa(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button className="boton w-full" disabled={cargando || !casa.trim()}>
            {cargando ? "Buscando…" : "Continuar"}
          </button>
        </form>
      )}

      {paso === "archivo" && (
        <div className="tarjeta space-y-5">
          <p className="text-sm">
            Casa <strong>{casa}</strong>
            {alicuota ? <> · Alícuota mensual <strong>${alicuota.toFixed(2)}</strong></> : null}
            {" · "}
            <button className="text-verde underline" onClick={() => setPaso("casa")}>cambiar</button>
          </p>

          <div className="rounded-xl bg-piedra-100 p-4 text-sm">
            <p className="mb-2 font-semibold">Cómo subir el comprobante</p>
            <ul className="space-y-1.5 text-carbon-suave">
              <li>✅ <strong>Lo mejor:</strong> el PDF o la captura de pantalla que te da la app de tu banco.</li>
              <li>📷 Si es una foto: el comprobante completo, plano, con buena luz y sin reflejos.</li>
              <li>🔍 Que se lean el <strong>monto</strong>, la <strong>fecha</strong> y el <strong>número de comprobante</strong>.</li>
              <li>🚫 Nada de fotos borrosas, cortadas o tomadas de lado.</li>
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`boton cursor-pointer ${cargando ? "pointer-events-none opacity-50" : ""}`}>
              📷 Tomar foto
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={elegirArchivo} disabled={cargando} />
            </label>
            <label className={`boton-sec cursor-pointer ${cargando ? "pointer-events-none opacity-50" : ""}`}>
              📄 Subir foto o PDF
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={elegirArchivo} disabled={cargando} />
            </label>
          </div>

          {cargando && (
            <p className="animate-pulse text-center text-sm text-carbon-suave">
              Leyendo tu comprobante… puede tardar unos segundos.
            </p>
          )}
        </div>
      )}

      {paso === "revisar" && (
        <form onSubmit={enviar} className="tarjeta space-y-4">
          <div className="flex items-start gap-3">
            {vista ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vista} alt="Comprobante" className="h-28 w-24 rounded-lg border border-piedra-200 object-cover" />
            ) : (
              <div className="flex h-28 w-24 items-center justify-center rounded-lg border border-piedra-200 bg-piedra-100 text-xs">PDF</div>
            )}
            <div className="text-sm">
              <p>Casa <strong>{casa}</strong></p>
              <p className="text-carbon-suave">{archivo?.name}</p>
              <button type="button" className="mt-1 text-verde underline" onClick={reiniciar}>
                Subir otro archivo
              </button>
            </div>
          </div>

          {avisos.map((a, i) => (
            <div
              key={i}
              className={`rounded-lg px-4 py-3 text-sm ${
                a.tipo === "error"
                  ? "bg-rojo-claro text-rojo"
                  : a.tipo === "alerta"
                    ? "bg-ambar-claro text-ambar"
                    : "bg-verde-claro text-verde-oscuro"
              }`}
            >
              {a.texto}
            </div>
          ))}

          {!bloqueado && (
            <>
              <p className="text-sm text-carbon-suave">
                {lectura
                  ? "Revisa que los datos coincidan con tu comprobante y corrige lo que haga falta."
                  : "Completa los datos tal como aparecen en tu comprobante."}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Monto pagado (USD)" valor={datos.monto} inputMode="decimal" requerido
                  onChange={(v) => setDatos({ ...datos, monto: v })} placeholder="60.00" />
                <Campo etiqueta="Fecha del pago" tipo="date" valor={datos.fecha} requerido
                  onChange={(v) => setDatos({ ...datos, fecha: v })} />
                <Campo etiqueta="Número de comprobante" valor={datos.referencia} requerido
                  onChange={(v) => setDatos({ ...datos, referencia: v })} placeholder="Ej. 123456789" />
                <Campo etiqueta="Banco" valor={datos.banco}
                  onChange={(v) => setDatos({ ...datos, banco: v })} placeholder="Ej. Banco Pichincha" />
                <Campo etiqueta="Nombre de quien pagó" valor={datos.ordenante}
                  onChange={(v) => setDatos({ ...datos, ordenante: v })} />
                <Campo etiqueta="Concepto" valor={datos.concepto}
                  onChange={(v) => setDatos({ ...datos, concepto: v })} />
              </div>
              <button className="boton w-full" disabled={cargando}>
                {cargando ? "Registrando…" : "Registrar pago"}
              </button>
            </>
          )}
        </form>
      )}

      {paso === "listo" && (
        <div className="tarjeta space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-verde-claro text-2xl">✓</div>
          <h2 className="text-xl font-semibold">Pago registrado</h2>
          <p className="text-carbon-suave">
            Tu pago de <strong>${Number(datos.monto).toFixed(2)}</strong> para la casa{" "}
            <strong>{casa}</strong> quedó <strong>pendiente de verificación</strong>. Cuando la
            administración lo confirme con el banco, aparecerá como aprobado.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href={`/consulta?casa=${encodeURIComponent(casa)}`} className="boton">Ver mis pagos</Link>
            <button className="boton-sec" onClick={reiniciar}>Subir otro comprobante</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Pasos({ actual }: { actual: Paso }) {
  const pasos: [Paso, string][] = [
    ["casa", "Casa"],
    ["archivo", "Comprobante"],
    ["revisar", "Revisar"],
    ["listo", "Listo"],
  ];
  const i = pasos.findIndex(([p]) => p === actual);
  return (
    <ol className="flex gap-2 text-xs">
      {pasos.map(([p, t], n) => (
        <li key={p} className={`flex-1 border-t-4 pt-1 ${n <= i ? "border-verde text-verde" : "border-piedra-200 text-carbon-suave"}`}>
          {t}
        </li>
      ))}
    </ol>
  );
}

function Campo(props: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
  requerido?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="etiqueta">
        {props.etiqueta}
        {props.requerido && <span className="text-rojo"> *</span>}
      </label>
      <input
        id={id}
        className="campo"
        type={props.tipo ?? "text"}
        value={props.valor}
        required={props.requerido}
        placeholder={props.placeholder}
        inputMode={props.inputMode}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
