// StatusLabel: shows whether a condition is met, not met, or needs review.
//
// Each status has a word and a symbol as well as a colour, so the meaning
// is still clear to someone who cannot tell the colours apart, and on a
// black-and-white print.
import type { EligibilityStatus } from "../api";

const LOOKS: Record<EligibilityStatus, { text: string; symbol: string; colours: string }> = {
  met: { text: "Met", symbol: "✓", colours: "border-green-300 bg-green-50 text-green-800" },
  not_met: { text: "Not met", symbol: "✕", colours: "border-red-300 bg-red-50 text-red-800" },
  needs_review: {
    text: "Needs review",
    symbol: "?",
    colours: "border-amber-300 bg-amber-50 text-amber-900",
  },
};

export default function StatusLabel({ status }: { status: EligibilityStatus }) {
  // A status this page does not know is treated as "needs review", the
  // safe choice.
  const look = LOOKS[status] ?? LOOKS.needs_review;

  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 " +
        "text-sm font-medium whitespace-nowrap " +
        look.colours
      }
    >
      {/* aria-hidden: screen readers read the word, not the symbol. */}
      <span aria-hidden="true">{look.symbol}</span>
      {look.text}
    </span>
  );
}
