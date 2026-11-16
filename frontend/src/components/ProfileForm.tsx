// ProfileForm: loads the firm's saved profile, lets the user edit it, and
// saves it (FR-02).
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import {
  ApiError,
  errorMessage,
  getProfile,
  saveProfile,
  type CompanyProfile,
  type CompanyProfileInput,
} from "../api";
import { isValid, validateMoney, validateWholeNumber } from "../validation";
import Button from "./Button";
import Field from "./Field";
import Message from "./Message";

// Inputs always hold text, so the form keeps every value as a string and
// converts to and from the server's shape with the two functions below.
type FormValues = Record<keyof CompanyProfileInput, string>;

const EMPTY_FORM: FormValues = {
  business_type: "",
  trade_licence_no: "",
  tin: "",
  vat_reg: "",
  annual_turnover: "",
  liquid_assets: "",
  years_of_experience: "",
};

// Server -> form: an empty value (null) becomes an empty text box.
function toForm(profile: CompanyProfile): FormValues {
  return {
    business_type: profile.business_type ?? "",
    trade_licence_no: profile.trade_licence_no ?? "",
    tin: profile.tin ?? "",
    vat_reg: profile.vat_reg ?? "",
    annual_turnover: profile.annual_turnover ?? "",
    liquid_assets: profile.liquid_assets ?? "",
    years_of_experience: profile.years_of_experience?.toString() ?? "",
  };
}

// Form -> server: an empty text box becomes null.
function toInput(form: FormValues): CompanyProfileInput {
  const textOrNull = (value: string) => value.trim() || null;
  return {
    business_type: textOrNull(form.business_type),
    trade_licence_no: textOrNull(form.trade_licence_no),
    tin: textOrNull(form.tin),
    vat_reg: textOrNull(form.vat_reg),
    annual_turnover: textOrNull(form.annual_turnover),
    liquid_assets: textOrNull(form.liquid_assets),
    years_of_experience:
      form.years_of_experience.trim() === "" ? null : Number(form.years_of_experience),
  };
}

export default function ProfileForm() {
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormValues>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  // Load the saved profile once, when the form first appears.
  useEffect(() => {
    getProfile()
      .then((profile) => setForm(toForm(profile)))
      .catch((problem) => setServerError(errorMessage(problem)))
      .finally(() => setIsLoading(false));
  }, []);

  // One change handler for every input: the input's name says which value
  // to update.
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [event.target.name]: event.target.value });
    setSavedMessage(""); // the "saved" note no longer describes what is on screen
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError("");
    setSavedMessage("");

    const found = {
      annual_turnover: validateMoney(form.annual_turnover, "Annual turnover"),
      liquid_assets: validateMoney(form.liquid_assets, "Liquid assets"),
      years_of_experience: validateWholeNumber(
        form.years_of_experience,
        "Years of experience",
        0,
        200,
      ),
    };
    setErrors(found);
    if (!isValid(found)) return;

    setIsSaving(true);
    try {
      const saved = await saveProfile(toInput(form));
      setForm(toForm(saved)); // show exactly what the server stored
      setSavedMessage("Profile saved.");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors); // the server's own message per field
      }
      setServerError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-slate-600">Loading profile…</p>;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Two columns on a wide screen, one on a phone. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Business type"
          name="business_type"
          value={form.business_type}
          onChange={handleChange}
          error={errors.business_type}
          hint="For example: Construction"
        />
        <Field
          label="Trade licence number"
          name="trade_licence_no"
          value={form.trade_licence_no}
          onChange={handleChange}
          error={errors.trade_licence_no}
        />
        <Field
          label="TIN"
          name="tin"
          value={form.tin}
          onChange={handleChange}
          error={errors.tin}
        />
        <Field
          label="VAT registration number"
          name="vat_reg"
          value={form.vat_reg}
          onChange={handleChange}
          error={errors.vat_reg}
        />
        <Field
          label="Annual turnover"
          name="annual_turnover"
          inputMode="decimal"
          value={form.annual_turnover}
          onChange={handleChange}
          error={errors.annual_turnover}
          hint="Full amount, for example 30000000"
        />
        <Field
          label="Liquid assets"
          name="liquid_assets"
          inputMode="decimal"
          value={form.liquid_assets}
          onChange={handleChange}
          error={errors.liquid_assets}
          hint="Full amount, for example 7500000"
        />
        <Field
          label="Years of experience"
          name="years_of_experience"
          inputMode="numeric"
          value={form.years_of_experience}
          onChange={handleChange}
          error={errors.years_of_experience}
        />
      </div>

      <Message kind="error">{serverError}</Message>
      <Message kind="success">{savedMessage}</Message>

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
