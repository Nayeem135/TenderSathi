// Field: one labelled input with its error message underneath.
// Every form in the app uses it, so all fields look and behave the same.
import type { InputHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  // The error to show under the input; empty or missing means no error.
  error?: string;
  // An optional hint shown under the input when there is no error.
  hint?: string;
  // "...and any normal <input> property", such as type, value, onChange.
} & InputHTMLAttributes<HTMLInputElement>;

export default function Field({ label, error, hint, id, name, ...inputProps }: FieldProps) {
  // The label and the messages are tied to the input by id, which is what
  // lets screen readers read them out together.
  const inputId = id ?? name;
  const messageId = `${inputId}-message`;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className={
          "mt-1 block w-full rounded-md border px-3 py-2 text-slate-900 " +
          "focus:outline-2 focus:outline-offset-1 focus:outline-blue-600 " +
          (error ? "border-red-600" : "border-slate-300")
        }
        {...inputProps}
      />
      {error ? (
        <p id={messageId} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1 text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
