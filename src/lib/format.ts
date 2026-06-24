export const formatCOP = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
};

export const formatDate = (d: string | Date | null | undefined): string => {
  if (!d) return "—";
  let date: Date;
  if (typeof d === "string") {
    const iso = d.split("T")[0];
    const parts = iso.split("-");
    date = parts.length === 3
      ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      : new Date(d);
  } else {
    date = d;
  }
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};
