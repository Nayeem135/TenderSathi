// Small checks used by the company profile forms. (The login and register
// rules are zod schemas in authSchemas.ts.) Each function returns an error message,
// or an empty string "" when the value is fine. The same rules are checked
// again by the backend; checking here first gives the user an answer
// without waiting for a request.

export function validateRequired(value: string, label: string): string {
  return value.trim() === "" ? `${label} is required.` : "";
}

// A money amount: digits, optionally a dot and one or two more digits.
// That also rules out negative numbers, letters and commas.
export function validateMoney(value: string, label: string, required = false): string {
  const text = value.trim();
  if (text === "") return required ? `${label} is required.` : "";
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return `${label} must be a number that is not negative, like 2500000 or 2500000.50.`;
  }
  return "";
}

// A whole number between min and max.
export function validateWholeNumber(
  value: string,
  label: string,
  min: number,
  max: number,
  required = false,
): string {
  const text = value.trim();
  if (text === "") return required ? `${label} is required.` : "";
  if (!/^\d+$/.test(text)) return `${label} must be a whole number.`;
  const number = Number(text);
  if (number < min || number > max) return `${label} must be between ${min} and ${max}.`;
  return "";
}

// True when every message in the object is empty, so the form can be sent.
export function isValid(errors: Record<string, string>): boolean {
  return Object.values(errors).every((message) => message === "");
}
