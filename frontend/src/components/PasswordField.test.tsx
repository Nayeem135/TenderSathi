// The show/hide button and the strength score of PasswordField.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import PasswordField, { passwordStrength } from "./PasswordField";

describe("PasswordField", () => {
  it("hides the password until the show button is pressed", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" name="password" />);
    const input = screen.getByLabelText("Password");

    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /show what was typed/i }));
    expect(input).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /hide what was typed/i }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("shows the strength while typing", () => {
    render(<PasswordField label="Password" name="password" strengthOf="Secret123!long" />);

    expect(screen.getByText("Strong")).toBeInTheDocument();
  });
});

describe("passwordStrength", () => {
  it.each([
    ["", 0],
    ["abc", 0],
    ["abcdefgh", 1], // no digit: never more than weak
    ["abcdefg1", 1],
    ["abcdefgh1234", 2],
    ["Abcdefgh1234", 3],
    ["Abcdefgh1234!", 4],
  ])("%s scores %i", (password, score) => {
    expect(passwordStrength(password)).toBe(score);
  });
});
