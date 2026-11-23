// RegisterPage: creates a user and their firm, then logs them in (FR-01).
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { ApiError, errorMessage, register as registerUser } from "../api";
import { useAuth } from "../auth";
import { registerSchema, type RegisterValues } from "../authSchemas";
import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Field from "../components/Field";
import Message from "../components/Message";
import PasswordField from "../components/PasswordField";

// The backend names some fields differently from this form.
const SERVER_FIELD_NAMES: Record<string, keyof RegisterValues> = {
  firm_name: "firmName",
  email: "email",
  password: "password",
};

export default function RegisterPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    // watch("password") gives the password as it is typed, for the strength meter.
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firmName: "", email: "", password: "", confirm: "" },
  });

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(values: RegisterValues) {
    try {
      await registerUser(values.email, values.password, values.firmName);
      // Registering does not log the user in, so do that now.
      await login(values.email, values.password);
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        // The server can refuse a field too, for example
        // "An account with this email already exists". Show those under the
        // matching fields.
        for (const [serverName, message] of Object.entries(error.fieldErrors)) {
          const field = SERVER_FIELD_NAMES[serverName];
          if (field) setError(field, { type: "server", message });
        }
      }
      setError("root.server", { message: errorMessage(error) });
    }
  }

  return (
    <AuthShell
      title="Register your firm"
      subtitle="Create a free account. It takes less than a minute."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Message kind="error">{errors.root?.server?.message}</Message>

        <Field
          label="Firm name"
          autoComplete="organization"
          placeholder="e.g. Rahman Builders Ltd"
          {...register("firmName")}
          error={errors.firmName?.message}
        />
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
          autoComplete="new-password"
          {...register("password")}
          error={errors.password?.message}
          hint="At least 8 characters, with a letter and a digit."
          strengthOf={watch("password")}
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          {...register("confirm")}
          error={errors.confirm?.message}
        />

        <Button type="submit" size="lg" isLoading={isSubmitting} className="w-full">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
