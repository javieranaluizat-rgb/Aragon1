export const dinero = (n: number | string | null | undefined) =>
  n == null
    ? "—"
    : `$${Number(n).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fecha = (s: string | null | undefined) => {
  if (!s) return "—";
  const [a, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
