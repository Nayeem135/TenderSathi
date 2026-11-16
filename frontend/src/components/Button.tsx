// Button: the app's standard button, in three looks.
//   primary   the main action on a screen (Save, Log in)
//   secondary a less important action (Log out, View)
//   danger    something destructive (Delete)
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = {
  variant?: "primary" | "secondary" | "danger";
} & ButtonHTMLAttributes<HTMLButtonElement>;

const LOOKS = {
  primary: "bg-blue-700 text-white hover:bg-blue-800",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
};

export default function Button({ variant = "primary", className = "", ...buttonProps }: ButtonProps) {
  return (
    <button
      // type="button" stops a button inside a form from submitting it by
      // accident. Submit buttons pass type="submit" themselves.
      type="button"
      className={
        "rounded-md px-4 py-2 text-sm font-medium " +
        "focus:outline-2 focus:outline-offset-2 focus:outline-blue-600 " +
        "disabled:cursor-not-allowed disabled:opacity-60 " +
        LOOKS[variant] +
        " " +
        className
      }
      {...buttonProps}
    />
  );
}
