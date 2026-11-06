const ESTILOS: Record<string, [string, string]> = {
  pendiente: ["Pendiente", "bg-ambar-claro text-ambar"],
  conciliado: ["Aprobado", "bg-verde-claro text-verde-oscuro"],
  rechazado: ["Rechazado", "bg-rojo-claro text-rojo"],
};

export function Estado({ estado }: { estado: string }) {
  const [texto, clase] = ESTILOS[estado] ?? [estado, "bg-piedra-100"];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${clase}`}>
      {texto}
    </span>
  );
}
