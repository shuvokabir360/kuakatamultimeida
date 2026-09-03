const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBn(input: string | number | null | undefined): string {
  if (input === null || input === undefined || input === "") {
    return "০";
  }
  return String(input).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

export function taka(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  if (Number.isNaN(num)) return "৳ ০";
  const formatted = num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return `৳ ${formatted}`;
}

export function bnDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  if (typeof d === "string") {
    // If format is YYYY-MM-DD
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, day] = match;
      return toBn(`${day}/${m}/${y}`);
    }
  }
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return toBn(date.toLocaleDateString("en-GB"));
}
