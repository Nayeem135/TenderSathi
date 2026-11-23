/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Vite is the tool that runs the dev server and builds the app.
// - react(): lets Vite understand React and JSX.
// - tailwindcss(): turns the Tailwind class names used in the components into CSS.
// The dev server runs on http://localhost:5173, which the backend allows (CORS).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  // Vitest (npm test) reads its settings from here too.
  // - jsdom: a pretend browser, so components can be drawn without one.
  // - setupFiles: run before every test file.
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Tests always run against the mock switch being off, whatever .env says.
    env: { VITE_USE_MOCKS: "false" },
  },
});
