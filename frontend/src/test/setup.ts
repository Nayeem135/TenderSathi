// Runs before every test file (see "test" in vite.config.ts).
import "@testing-library/jest-dom/vitest"; // adds checks like toBeInTheDocument()
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Remove what the last test drew, and anything it saved, so each test
// starts from an empty page and no stored token.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
