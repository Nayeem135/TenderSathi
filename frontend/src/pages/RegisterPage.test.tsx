// Tests for the register form's validation (FR-01).
//
// The real backend is not used: the two api.ts functions the page calls,
// register and login, are replaced with fakes (vi.mock below), so each test
// decides what the "server" answers.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../api";
import { AuthProvider } from "../auth";
import { ThemeProvider } from "../theme";
import RegisterPage from "./RegisterPage";

// Keep everything in api.ts real except register and login.
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  register: vi.fn(),
  login: vi.fn(),
}));

const registerMock = vi.mocked(api.register);
const loginMock = vi.mocked(api.login);

beforeEach(() => {
  registerMock.mockReset();
  loginMock.mockReset();
});

// Draws the page as the app would, with a home page to land on afterwards.
function renderPage() {
  render(
    <ThemeProvider>
    <MemoryRouter initialEntries={["/register"]}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<p>Home page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
    </ThemeProvider>,
  );
  return userEvent.setup();
}

// Fills in the form. Any field left out of `values` gets a valid value.
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values: Partial<Record<"firm" | "email" | "password" | "confirm", string>> = {},
) {
  const filled = {
    firm: "Rahman Builders",
    email: "owner@example.com",
    password: "secret123",
    confirm: values.password ?? "secret123",
    ...values,
  };
  // An empty string means "leave the field empty".
  const type = async (label: string | RegExp, text: string) => {
    if (text !== "") await user.type(screen.getByLabelText(label), text);
  };
  await type("Firm name", filled.firm);
  await type("Email", filled.email);
  await type(/^Password/, filled.password);
  await type("Confirm password", filled.confirm);
}

function submit(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("RegisterPage validation", () => {
  it("shows an error under every field when the form is sent empty", async () => {
    const user = renderPage();
    await submit(user);

    // toHaveAccessibleDescription checks the message is tied to its input,
    // so a screen reader reads it with the field.
    expect(screen.getByLabelText("Firm name")).toHaveAccessibleDescription(
      "Firm name is required.",
    );
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Email is required.");
    expect(screen.getByLabelText(/^Password/)).toHaveAccessibleDescription(
      "Password must be at least 8 characters long.",
    );
    expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription(
      "Please type the password again.",
    );
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("treats a firm name of only spaces as empty", async () => {
    const user = renderPage();
    await fillForm(user, { firm: "   " });
    await submit(user);

    expect(await screen.findByText("Firm name is required.")).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("rejects an email address that is not valid", async () => {
    const user = renderPage();
    await fillForm(user, { email: "owner@example" });
    await submit(user);

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it.each([
    ["shorter than 8 characters", "abc123", "Password must be at least 8 characters long."],
    ["without a letter", "12345678", "Password must contain at least one letter."],
    ["without a digit", "abcdefgh", "Password must contain at least one digit."],
  ])("rejects a password %s", async (_case, password, message) => {
    const user = renderPage();
    await fillForm(user, { password });
    await submit(user);

    expect(screen.getByLabelText(/^Password/)).toHaveAccessibleDescription(message);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("rejects a confirm password that does not match", async () => {
    const user = renderPage();
    await fillForm(user, { password: "secret123", confirm: "secret124" });
    await submit(user);

    expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription(
      "The two passwords do not match.",
    );
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("clears an error once the field is corrected", async () => {
    const user = renderPage();
    await fillForm(user, { email: "not-an-email" });
    await submit(user);
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();

    const email = screen.getByLabelText("Email");
    await user.clear(email);
    await user.type(email, "owner@example.com");

    expect(screen.queryByText("Enter a valid email address.")).not.toBeInTheDocument();
  });

  it("sends trimmed values, logs in, and goes to the home page", async () => {
    registerMock.mockResolvedValue({} as api.User);
    loginMock.mockResolvedValue({ access_token: "test-token" });

    const user = renderPage();
    await fillForm(user, { firm: "  Rahman Builders  ", email: "  owner@example.com " });
    await submit(user);

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(registerMock).toHaveBeenCalledWith("owner@example.com", "secret123", "Rahman Builders");
    expect(loginMock).toHaveBeenCalledWith("owner@example.com", "secret123");
    expect(api.getToken()).toBe("test-token");
  });

  it("shows the server's error under the field and at the top of the form", async () => {
    registerMock.mockRejectedValue(
      new api.ApiError(409, "Email already registered", {
        email: "An account with this email already exists",
      }),
    );

    const user = renderPage();
    await fillForm(user);
    await submit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Email already registered");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "An account with this email already exists",
    );
    expect(loginMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Home page")).not.toBeInTheDocument();
  });
});
