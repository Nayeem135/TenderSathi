// ProfileForm: loads the firm's saved profile, lets the user edit it, and
// saves it (FR-02).
import { Landmark, Save, Wallet } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

import {
  ApiError,
  errorMessage,
  getProfile,
  saveProfile,
  type CompanyProfile,
  type CompanyProfileInput,
} from "../api";
import { formatLakhCrore } from "../format";
import { profileCompleteness } from "../profileCompleteness";
import { isValid, validateMoney, validateWholeNumber } from "../validation";
import Button from "./Button";
import Card from "./Card";
import Field from "./Field";
import Message from "./Message";
import Skeleton from "./Skeleton";

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

// "35000000.00" -> "35000000": the server always sends two decimals, but
// whole amounts are easier to read without them.
function plainAmount(value: string | null): string {
  return (value ?? "").replace(/\.00$/, "");
}

// Server -> form: an empty value (null) becomes an empty text box.
function toForm(profile: CompanyProfile): FormValues {
  return {
    business_type: profile.business_type ?? "",
    trade_licence_no: profile.trade_licence_no ?? "",
    tin: profile.tin ?? "",
    vat_reg: profile.vat_reg ?? "",
    annual_turnover: plainAmount(profile.annual_turnover),
    liquid_assets: plainAmount(profile.liquid_assets),
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
  // The profile as last loaded or saved, for the completeness bar.
  const [saved, setSaved] = useState<CompanyProfile | null>(null);

  // Load the saved profile once, when the form first appears.
  useEffect(() => {
    getProfile()
      .then((profile) => {
        setForm(toForm(profile));
        setSaved(profile);
      })
      .catch((problem) => setServerError(errorMessage(problem)))
      .finally(() => setIsLoading(false));
  }, []);

  // One change handler for every input: the input's name says which value
  // to update.
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError("");

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
      const stored = await saveProfile(toInput(form));
      setForm(toForm(stored)); // show exactly what the server stored
      setSaved(stored);
      toast.success("Profile saved", { description: "New analyses will use these details." });
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
    return (
      <div role="status" className="space-y-6">
        <span className="sr-only">Loading profile…</span>
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  // The live "= 3.5 crore" note under a money field, so the user can check
  // the number of zeros they typed against the tender's wording.
  const moneyHint = (value: string, example: string) => {
    const words = formatLakhCrore(value);
    return words ? (
      <>
        = <span className="font-medium text-fg-2">{words}</span>
      </>
    ) : (
      `Full amount in taka, for example ${example}`
    );
  };

  const completeness = profileCompleteness(saved);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* How much of the profile is filled in. */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="font-medium text-fg">Profile completeness</p>
          <p className="font-semibold text-fg tabular-nums">{completeness}%</p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-surface-subtle"
          role="progressbar"
          aria-label="Profile completeness"
          aria-valuenow={completeness}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-all ${completeness === 100 ? "bg-green-600" : "bg-brand-600"}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-fg-4">
          {completeness === 100
            ? "Everything is filled in. Tender checks will be as accurate as possible."
            : "Missing details are marked \"Needs review\" in reports. Fill in everything for the best results."}
        </p>
      </div>

      <Card
        title="Business details"
        description="Your registration details. Used for licence, TIN and VAT conditions."
        icon={<Landmark aria-hidden="true" className="size-5" />}
      >
        {/* Two columns on a wide screen, one on a phone. */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Business type"
            name="business_type"
            value={form.business_type}
            onChange={handleChange}
            error={errors.business_type}
            placeholder="e.g. Civil construction"
          />
          <Field
            label="Trade licence number"
            name="trade_licence_no"
            value={form.trade_licence_no}
            onChange={handleChange}
            error={errors.trade_licence_no}
            placeholder="e.g. TRAD/DNCC/012345/2026"
          />
          <Field
            label="TIN"
            name="tin"
            value={form.tin}
            onChange={handleChange}
            error={errors.tin}
            hint="Tax identification number"
          />
          <Field
            label="VAT registration number"
            name="vat_reg"
            value={form.vat_reg}
            onChange={handleChange}
            error={errors.vat_reg}
            hint="BIN / VAT registration"
          />
        </div>
      </Card>

      <Card
        title="Financial capacity and experience"
        description="Compared directly with the turnover, liquid asset and experience conditions in each tender."
        icon={<Wallet aria-hidden="true" className="size-5" />}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Annual turnover"
            name="annual_turnover"
            inputMode="decimal"
            prefix="Tk"
            value={form.annual_turnover}
            onChange={handleChange}
            error={errors.annual_turnover}
            hint={moneyHint(form.annual_turnover, "35000000")}
          />
          <Field
            label="Liquid assets"
            name="liquid_assets"
            inputMode="decimal"
            prefix="Tk"
            value={form.liquid_assets}
            onChange={handleChange}
            error={errors.liquid_assets}
            hint={moneyHint(form.liquid_assets, "7500000")}
          />
          <Field
            label="Years of experience"
            name="years_of_experience"
            inputMode="numeric"
            value={form.years_of_experience}
            onChange={handleChange}
            error={errors.years_of_experience}
            hint="How long the firm has worked in this field"
          />
        </div>
      </Card>

      <Message kind="error">{serverError}</Message>

      <div className="flex justify-end">
        <Button
          type="submit"
          size="lg"
          isLoading={isSaving}
          icon={<Save aria-hidden="true" className="size-4" />}
        >
          {isSaving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
