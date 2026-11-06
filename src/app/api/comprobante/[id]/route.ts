import { NextResponse } from "next/server";
import { esAdmin } from "@/lib/auth";
import { q1 } from "@/lib/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await esAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const fila = await q1<{ archivo: Uint8Array; archivo_tipo: string }>(
    "SELECT archivo, archivo_tipo FROM pagos WHERE id = $1",
    [Number(id) || 0],
  );
  if (!fila) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return new NextResponse(Buffer.from(fila.archivo), {
    headers: {
      "Content-Type": fila.archivo_tipo,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
