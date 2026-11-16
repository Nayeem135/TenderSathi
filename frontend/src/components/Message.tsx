// Message: a coloured box for telling the user something went wrong
// ("error") or went well ("success"). It shows nothing when there is no text.
type MessageProps = {
  kind: "error" | "success";
  children?: string;
};

export default function Message({ kind, children }: MessageProps) {
  if (!children) return null;

  const isError = kind === "error";
  return (
    <p
      // role="alert" makes screen readers announce an error straight away;
      // role="status" announces a success more quietly.
      role={isError ? "alert" : "status"}
      className={
        "rounded-md border px-3 py-2 text-sm " +
        (isError
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-green-300 bg-green-50 text-green-800")
      }
    >
      {/* The word, not only the colour, says what kind of message it is. */}
      <span className="font-semibold">{isError ? "Error: " : "Done: "}</span>
      {children}
    </p>
  );
}
