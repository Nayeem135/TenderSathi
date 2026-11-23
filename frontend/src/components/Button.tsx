// Button: the app's standard button.
//   primary   the main action on a screen (Save, Log in)
//   secondary a less important action (Cancel, View)
//   danger    something destructive (Delete)
//   ghost     a quiet action inside a list or toolbar
// `icon` shows an icon before the text; `isLoading` shows a spinner instead
// and disables the button.
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import Spinner from "./Spinner";

type ButtonProps = {
  variant?: "primary" | "secondary" | "danger" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  isLoading?: boolean;
  // In React 19 a ref is an ordinary prop; it reaches the <button> below.
  ref?: Ref<HTMLButtonElement>;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const LOOKS = {
  primary:
    "bg-brand-700 text-white shadow-sm shadow-brand-900/20 hover:bg-brand-800 " +
    "bg-gradient-to-b from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800",
  secondary:
    "bg-surface text-fg shadow-sm ring-1 ring-line-strong ring-inset hover:bg-surface-muted",
  danger: "bg-surface text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-500/30 ring-inset hover:bg-red-50 dark:hover:bg-red-500/10",
  destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  ghost: "text-fg-2 hover:bg-surface-subtle",
};

const SIZES = {
  sm: "gap-1.5 px-3 py-1.5 text-sm",
  md: "gap-2 px-4 py-2 text-sm",
  lg: "gap-2 px-5 py-2.5 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  isLoading = false,
  disabled,
  className = "",
  children,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      // type="button" stops a button inside a form from submitting it by
      // accident. Submit buttons pass type="submit" themselves.
      type="button"
      disabled={disabled || isLoading}
      className={
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 " +
        "disabled:cursor-not-allowed disabled:opacity-60 " +
        `${LOOKS[variant]} ${SIZES[size]} ${className}`
      }
      {...buttonProps}
    >
      {isLoading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}
