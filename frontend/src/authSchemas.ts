// The rules for the login and register forms (FR-01), written with zod.
//
// A zod "schema" describes what valid form values look like. The forms hand
// it to react-hook-form (through zodResolver), which checks the values
// against it on submit and puts each failed rule's message under its field.
// The backend checks the same rules again; see the README for why both.
import { z } from "zod";

// Trim first, so "  " counts as empty and " a@b.com " is accepted.
const email = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .pipe(z.email("Enter a valid email address."));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});

export const registerSchema = z
  .object({
    firmName: z.string().trim().min(1, "Firm name is required."),
    email,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long.")
      .regex(/[A-Za-z]/, "Password must contain at least one letter.")
      .regex(/[0-9]/, "Password must contain at least one digit."),
    confirm: z.string().min(1, "Please type the password again."),
  })
  // A rule about two fields together goes on the whole object. `path` says
  // which field the message belongs under.
  .refine((values) => values.confirm === "" || values.password === values.confirm, {
    path: ["confirm"],
    message: "The two passwords do not match.",
    // Check the match even while another field (say, the firm name) is
    // still wrong, so every problem is shown at once.
    when: (payload) => typeof payload.value === "object" && payload.value !== null,
  });

// The types of the form values, worked out from the schemas, so they can
// never disagree with the rules.
export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
