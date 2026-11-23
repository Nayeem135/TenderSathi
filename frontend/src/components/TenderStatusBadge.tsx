// TenderStatusBadge: where a tender is in the process: uploaded, analyzed
// or failed. Like StatusLabel, it uses a word as well as a colour.
const LOOKS: Record<string, { text: string; className: string }> = {
  uploaded: { text: "Not analyzed", className: "bg-surface-subtle text-fg-2 ring-line" },
  analyzed: { text: "Analyzed", className: "bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300 ring-green-200 dark:ring-green-500/30" },
  failed: { text: "Analysis failed", className: "bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 ring-red-200 dark:ring-red-500/30" },
};

export default function TenderStatusBadge({ status }: { status: string }) {
  const look = LOOKS[status] ?? { text: status, className: "bg-surface-subtle text-fg-2 ring-line" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${look.className}`}
    >
      {look.text}
    </span>
  );
}
