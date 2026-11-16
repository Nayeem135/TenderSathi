// RegisterPage: creates a user and their firm, then logs them in (FR-01).
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { ApiError, errorMessage, register } from "../api";
import { useAuth } from "../auth";
import Button from "../components/Button";
import Field from "../components/Field";
import Message from "../components/Message";
import {
  isValid,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
  validateRequired,
} from "../validation";

const NO_ERRORS = { firmName: "", email: "", password: "", confirm: "" };

export default function RegisterPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();

  const [firmName, setFirmName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState(NO_ERRORS);
  const [serverError, setServerError] = useState("");
  const [isSending, setIsSending] = useState(false);

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError("");

    const found = {
      firmName: validateRequired(firmName, "Firm name"),
      email: validateEmail(email),
      password: validatePassword(password),
      confirm: validateConfirmPassword(password, confirm),
    };
    setErrors(found);
    if (!isValid(found)) return;

    setIsSending(true);
    try {
      await register(email.trim(), password, firmName.trim());
      // Registering does not log the user in, so do that now.
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        // The server can refuse a field too, for example
        // "An account with this email already exists". Show those under the
        // matching fields. The server calls the firm field "firm_name".
        setErrors({
          ...NO_ERRORS,
          firmName: error.fieldErrors.firm_name ?? "",
          email: error.fieldErrors.email ?? "",
          password: error.fieldErrors.password ?? "",
        });
      }
      setServerError(errorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Register your firm</h1>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Message kind="error">{serverError}</Message>

        <Field
          label="Firm name"
          name="firmName"
          autoComplete="organization"
          value={firmName}
          onChange={(event) => setFirmName(event.target.value)}
          error={errors.firmName}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          hint="At least 8 characters, with a letter and a digit."
        />
        <Field
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={errors.confirm}
        />

        <Button type="submit" disabled={isSending} className="w-full">
          {isSending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Already registered?{" "}
        <Link to="/login" className="font-medium text-blue-700 underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
