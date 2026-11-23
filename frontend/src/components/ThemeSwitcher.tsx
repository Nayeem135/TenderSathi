// ThemeSwitcher: three small buttons to choose Light, Dark or System.
// Used in the account menu and on the login and register pages.
import { Monitor, Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";

import { useTheme, type ThemeChoice } from "../theme";

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export default function ThemeSwitcher({ showLabels = false }: { showLabels?: boolean }) {
  const { choice, setChoice } = useTheme();

  return (
    <div role="group" aria-label="Theme" className="inline-flex gap-0.5 rounded-lg bg-surface-subtle p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={choice === value}
          title={label}
          onClick={() => setChoice(value)}
          className={
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors " +
            (choice === value ? "bg-surface text-fg shadow-sm" : "text-fg-4 hover:text-fg")
          }
        >
          <Icon aria-hidden="true" className="size-3.5" />
          {showLabels ? label : <span className="sr-only">{label}</span>}
        </button>
      ))}
    </div>
  );
}

// ThemeToggle: one round button that flips between light and dark. Shown in
// the top bar for a quick switch.
export function ThemeToggle() {
  const { resolved, setChoice } = useTheme();
  const isDark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={() => setChoice(isDark ? "light" : "dark")}
      className="rounded-full p-2 text-fg-4 transition-colors hover:bg-surface-subtle hover:text-fg"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun aria-hidden="true" className="size-5" /> : <Moon aria-hidden="true" className="size-5" />}
      <span className="sr-only">{isDark ? "Switch to light mode" : "Switch to dark mode"}</span>
    </button>
  );
}

// The pop-up notifications, in the same theme as the page.
export function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="top-right" richColors closeButton />;
}
