// PasswordField: a password input with a button to show or hide what was
// typed, and (optionally) a meter of how strong the password is.
import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import Field from "./Field";

// A rough strength score from 0 to 4. It only guides the user; the real
// rules (8+ characters, a letter and a digit) are checked by the form.
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  // Too short, or missing a letter or digit: never more than "Weak".
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return Math.min(score, 1);
  return Math.max(score, 1);
}

const LEVELS = [
  { text: "", color: "" },
  { text: "Weak", color: "bg-red-500" },
  { text: "Fair", color: "bg-amber-500" },
  { text: "Good", color: "bg-lime-500" },
  { text: "Strong", color: "bg-green-600" },
];

function StrengthMeter({ password }: { password: string }) {
  const score = passwordStrength(password);
  if (!password) return null;
  const level = LEVELS[score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-1.5 flex-1 rounded-full transition-colors ${step <= score ? level.color : "bg-surface-subtle"}`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-fg-4">
        Strength: <span className="font-medium text-fg-2">{level.text}</span>
        {score < 3 && " · Longer, with capitals and symbols, is stronger."}
      </p>
    </div>
  );
}

type PasswordFieldProps = Omit<ComponentProps<typeof Field>, "type" | "endAdornment" | "after"> & {
  // The current value, for the strength meter. Leave out to hide the meter.
  strengthOf?: string;
};

export default function PasswordField({ strengthOf, ...fieldProps }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Field
      {...fieldProps}
      type={isVisible ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          aria-pressed={isVisible}
          title={isVisible ? "Hide" : "Show"}
          className="rounded-md p-1.5 text-fg-5 hover:bg-surface-subtle hover:text-fg-2"
        >
          {isVisible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          <span className="sr-only">{isVisible ? "Hide" : "Show"} what was typed</span>
        </button>
      }
      after={strengthOf !== undefined ? <StrengthMeter password={strengthOf} /> : undefined}
    />
  );
}
