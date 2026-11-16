// Helpers for showing values on screen.

// "30000000.00" -> "3,00,00,000". The en-IN style groups digits the way
// lakh and crore are written.
export function formatMoney(value: string | null): string {
  if (value === null || value === "") return "—";
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// "2026-11-15T06:56:19Z" -> "15 Nov 2026"
export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
