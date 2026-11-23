// Helpers for showing values on screen.

// "30000000.00" -> "3,00,00,000". The en-IN style groups digits the way
// lakh and crore are written.
export function formatMoney(value: string | null): string {
  if (value === null || value === "") return "—";
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// "35000000" -> "3.5 crore", "5000000" -> "50 lakh", "75000" -> "75,000".
// Tenders state amounts in lakh and crore, so this helps the user check a
// figure they typed in full. Returns "" for an empty or invalid amount.
export function formatLakhCrore(value: string | null): string {
  const amount = Number(value);
  if (value === null || value.trim() === "" || !Number.isFinite(amount) || amount < 0) return "";
  const round = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (amount >= 10_000_000) return `${round(amount / 10_000_000)} crore`;
  if (amount >= 100_000) return `${round(amount / 100_000)} lakh`;
  return round(amount);
}

// "2026-11-15T06:56:19Z" -> "15 Nov 2026"
export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// The backend's condition categories, as shown on screen.
const CATEGORY_LABELS: Record<string, string> = {
  experience: "Experience",
  turnover: "Turnover",
  liquid_assets: "Liquid assets",
  similar_contracts: "Similar contracts",
  required_document: "Required document",
  tender_security: "Tender security",
  other: "Other",
};

// "liquid_assets" -> "Liquid assets". An unknown category is shown with its
// underscores turned into spaces, so a new one still reads sensibly.
export function formatCategory(category: string): string {
  const label = CATEGORY_LABELS[category] ?? category.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
