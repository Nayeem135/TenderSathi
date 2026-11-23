// StatusLabel: shows whether a condition is met, not met, or needs review.
//
// Each status has a word and an icon as well as a colour, so the meaning
// is still clear to someone who cannot tell the colours apart, and on a
// black-and-white print.
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";

import type { EligibilityStatus } from "../api";

export const STATUS_LOOKS = {
  met: {
    text: "Met",
    Icon: CheckCircle2,
    badge: "border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300",
    bar: "bg-green-600",
    accent: "border-l-green-600",
  },
  not_met: {
    text: "Not met",
    Icon: XCircle,
    badge: "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300",
    bar: "bg-red-600",
    accent: "border-l-red-600",
  },
  needs_review: {
    text: "Needs review",
    Icon: HelpCircle,
    badge: "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200",
    bar: "bg-amber-500",
    accent: "border-l-amber-500",
  },
} satisfies Record<EligibilityStatus, unknown>;

export default function StatusLabel({ status }: { status: EligibilityStatus }) {
  // A status this page does not know is treated as "needs review", the
  // safe choice.
  const look = STATUS_LOOKS[status] ?? STATUS_LOOKS.needs_review;

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 " +
        "text-sm font-medium whitespace-nowrap " +
        look.badge
      }
    >
      {/* aria-hidden: screen readers read the word, not the icon. */}
      <look.Icon aria-hidden="true" className="size-4" />
      {look.text}
    </span>
  );
}
