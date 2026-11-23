// Spinner: a small turning circle shown while something is loading.
import { Loader2 } from "lucide-react";

export default function Spinner({ className = "size-5" }: { className?: string }) {
  // aria-hidden: the text next to the spinner ("Saving…") is what screen
  // readers announce.
  return <Loader2 aria-hidden="true" className={`animate-spin ${className}`} />;
}

// A whole area that is loading, with a short message.
export function LoadingBlock({ children }: { children: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-fg-4" role="status">
      <Spinner />
      <span>{children}</span>
    </div>
  );
}
