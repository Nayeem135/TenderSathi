// Field: one labelled input with its error message underneath.
// Every form in the app uses it, so all fields look and behave the same.
import type { InputHTMLAttributes, ReactNode, Ref } from "react";

type FieldProps = {
  label: string;
  // react-hook-form's register() hands over a ref so it can read the input
  // directly. In React 19 a ref is an ordinary prop, so it is passed on to
  // the <input> with the rest.
  ref?: Ref<HTMLInputElement>;
  // The error to show under the input; empty or missing means no error.
  error?: string;
  // An optional hint shown under the input when there is no error.
  hint?: ReactNode;
  // Text shown inside the box before the value, such as "Tk" for money.
  prefix?: string;
  // Something clickable inside the box on the right, such as the
  // show/hide button of a password field.
  endAdornment?: ReactNode;
  // Extra content under the hint or error, such as a password strength meter.
  after?: ReactNode;
  // "...and any normal <input> property", such as type, value, onChange.
} & InputHTMLAttributes<HTMLInputElement>;

export default function Field({
  label,
  error,
  hint,
  prefix,
  endAdornment,
  after,
  id,
  name,
  className = "",
  ...inputProps
}: FieldProps) {
  // The label and the messages are tied to the input by id, which is what
  // lets screen readers read them out together.
  const inputId = id ?? name;
  const messageId = `${inputId}-message`;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-fg-2">
        {label}
      </label>
      <div className="relative mt-1.5">
        {prefix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium text-fg-4"
          >
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={
            "block w-full rounded-lg border bg-surface px-3 py-2 text-fg shadow-sm " +
            "placeholder:text-fg-5 transition-colors " +
            "focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none " +
            "file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1 " +
            "file:text-sm file:font-medium file:text-accent " +
            (prefix ? "pl-10 " : "") +
            (endAdornment ? "pr-11 " : "") +
            (error ? "border-red-500" : "border-line-strong")
          }
          {...inputProps}
        />
        {endAdornment && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{endAdornment}</div>}
      </div>
      {error ? (
        <p id={messageId} className="mt-1.5 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1.5 text-sm text-fg-4">
          {hint}
        </p>
      ) : null}
      {after}
    </div>
  );
}
