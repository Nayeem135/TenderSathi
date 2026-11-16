// LoginPage: the email and password form (FR-01).
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { errorMessage } from "../api";
import { useAuth } from "../auth";
import Button from "../components/Button";
import Field from "../components/Field";
import Message from "../components/Message";
import { isValid, validateEmail, validateRequired } from "../validation";

export default function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // useState holds a value that, when changed, redraws the component.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // One error message per field, shown under that field.
  const [errors, setErrors] = useState({ email: "", password: "" });
  // A message from the server, such as "Invalid email or password".
  const [serverError, setServerError] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Where to go after logging in: the page the user first asked for, if
  // ProtectedRoute sent them here, otherwise the home page.
  const destination: string = location.state?.from ?? "/";

  // Someone who is already logged in has no use for this page.
  if (token) {
    return <Navigate to={destination} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); // stop the browser from reloading the page
    setServerError("");

    // Check the fields first. If anything is wrong, show it and stop.
    const found = {
      email: validateEmail(email),
      password: validateRequired(password, "Password"),
    };
    setErrors(found);
    if (!isValid(found)) return;

    setIsSending(true);
    try {
      await login(email.trim(), password);
      navigate(destination, { replace: true });
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Log in to TenderSathi</h1>

      {/* noValidate turns off the browser's own pop-up messages, so only
          our messages under the fields are shown. */}
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Message kind="error">{serverError}</Message>

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
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />

        <Button type="submit" disabled={isSending} className="w-full">
          {isSending ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        No account yet?{" "}
        <Link to="/register" className="font-medium text-blue-700 underline">
          Register your firm
        </Link>
      </p>
    </main>
  );
}
