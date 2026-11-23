// LoginPage: the email and password form (FR-01).
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { errorMessage } from "../api";
import { useAuth } from "../auth";
import { loginSchema, type LoginValues } from "../authSchemas";
import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Field from "../components/Field";
import Message from "../components/Message";
import PasswordField from "../components/PasswordField";

export default function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // useForm keeps the field values, the error messages and whether the form
  // is being sent. zodResolver checks the values against loginSchema.
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Where to go after logging in: the page the user first asked for, if
  // ProtectedRoute sent them here, otherwise the home page.
  const destination: string = location.state?.from ?? "/";

  // Someone who is already logged in has no use for this page.
  if (token) {
    return <Navigate to={destination} replace />;
  }

  // handleSubmit only calls this once every field has passed the schema,
  // and passes the cleaned-up values (the email already trimmed).
  async function onSubmit(values: LoginValues) {
    try {
      await login(values.email, values.password);
      navigate(destination, { replace: true });
    } catch (error) {
      // "root.server" is a form-wide error, not tied to one field, such as
      // "Invalid email or password".
      setError("root.server", { message: errorMessage(error) });
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to check your firm's eligibility for tenders."
      footer={
        <>
          No account yet?{" "}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Register your firm
          </Link>
        </>
      }
    >
      {/* noValidate turns off the browser's own pop-up messages, so only
          our messages under the fields are shown. */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Message kind="error">{errors.root?.server?.message}</Message>

        {/* register("email") connects the input to the form: its name,
            value changes and ref. */}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          {...register("email")}
          error={errors.email?.message}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          {...register("password")}
          error={errors.password?.message}
        />

        <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
          {isSubmitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}
