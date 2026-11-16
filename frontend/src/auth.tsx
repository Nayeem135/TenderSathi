// Keeps track of whether the user is logged in, and shares that with every
// component in the app.
//
// A React "context" is a value that any component can read without it
// being passed down by hand through every level. Here the value is the
// token plus the login and logout functions.
import { createContext, useContext, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import * as api from "./api";

type AuthContextValue = {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// AuthProvider wraps the whole app (see main.tsx) and owns the token.
export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with the token saved in the browser, if there is one, so a page
  // refresh does not log the user out.
  const [token, setToken] = useState<string | null>(api.getToken());

  async function login(email: string, password: string) {
    const result = await api.login(email, password); // throws if the details are wrong
    api.setToken(result.access_token); // remember it in the browser
    setToken(result.access_token); // tell React, so the screen updates
  }

  function logout() {
    api.clearToken();
    setToken(null);
  }

  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>;
}

// useAuth() is how a component reads the context:
//   const { token, login, logout } = useAuth();
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return value;
}

// ProtectedRoute guards the pages that need a login. In App.tsx the private
// pages are placed inside it. With a token it shows the page (<Outlet /> is
// "the page that matched"); without one it sends the user to /login and
// remembers where they were going.
export function ProtectedRoute() {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
