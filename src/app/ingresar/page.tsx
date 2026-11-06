import { redirect } from "next/navigation";
import { sesion } from "@/lib/auth";
import { FormularioIngreso } from "./formulario";

export const metadata = { title: "Ingresar" };

export default async function Ingresar({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  const { siguiente } = await searchParams;
  const s = await sesion();
  if (s) redirect(s.rol === "admin" ? "/admin" : "/pagar");
  return <FormularioIngreso siguiente={siguiente ?? ""} />;
}
