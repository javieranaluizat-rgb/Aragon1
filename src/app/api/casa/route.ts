import { NextResponse } from "next/server";
import { buscarCasa } from "@/lib/casas";

export async function GET(req: Request) {
  const numero = new URL(req.url).searchParams.get("numero");
  const casa = await buscarCasa(numero);
  if (!casa) return NextResponse.json({ existe: false });
  return NextResponse.json({ existe: true, numero: casa.numero, alicuota: casa.alicuota });
}
