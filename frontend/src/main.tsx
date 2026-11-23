// The starting point of the app. It finds the <div id="root"> in index.html
// and draws the <App /> component inside it.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./auth";
import { ThemedToaster } from "./components/ThemeSwitcher";
import { ThemeProvider } from "./theme";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  // StrictMode shows extra warnings during development. It changes nothing
  // in the built app.
  <StrictMode>
    {/* ThemeProvider: light or dark mode, for every page. */}
    <ThemeProvider>
      {/* BrowserRouter lets the app show different pages for different URLs
          without reloading the browser. */}
      <BrowserRouter>
        {/* AuthProvider makes the login state available to every page. */}
        <AuthProvider>
          <App />
          {/* Where the small pop-up notifications ("Profile saved") appear. */}
          <ThemedToaster />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
