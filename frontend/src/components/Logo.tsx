// Logo: the TenderSathi mark (a tick in a square) and name.
import { Check } from "lucide-react";

export default function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={
          "flex size-8 items-center justify-center rounded-lg " +
          (inverted ? "bg-white text-brand-700" : "bg-brand-700 text-white")
        }
      >
        <Check aria-hidden="true" className="size-5" strokeWidth={3} />
      </span>
      <span className={`text-lg font-semibold tracking-tight ${inverted ? "text-white" : "text-fg"}`}>
        TenderSathi
      </span>
    </span>
  );
}
