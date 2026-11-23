// Message: a coloured box for telling the user something went wrong
// ("error") or went well ("success"). It shows nothing when there is no text.
import { CheckCircle2, XCircle } from "lucide-react";

type MessageProps = {
  kind: "error" | "success";
  children?: string;
};

export default function Message({ kind, children }: MessageProps) {
  if (!children) return null;

  const isError = kind === "error";
  const Icon = isError ? XCircle : CheckCircle2;
  return (
    <div
      // role="alert" makes screen readers announce an error straight away;
      // role="status" announces a success more quietly.
      role={isError ? "alert" : "status"}
      className={
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm " +
        (isError
          ? "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300"
          : "border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-800 dark:text-green-300")
      }
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>
        {/* The word, not only the colour, says what kind of message it is. */}
        <span className="font-semibold">{isError ? "Error: " : "Done: "}</span>
        {children}
      </p>
    </div>
  );
}
