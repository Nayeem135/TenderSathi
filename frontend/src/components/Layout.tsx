// Layout: the frame shared by every page after login. It draws the top
// bar with the navigation, and the current page underneath it.
//
// On a wide screen the links sit in a row in the top bar. On a phone
// there is no room for that, so they are hidden behind a "Menu" button
// and open as a list below the bar.
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { getMe } from "../api";
import LogoutButton from "./LogoutButton";

// The pages in the menu. To add a page to the navigation, add a line here.
const LINKS = [
  { to: "/tenders", label: "Tenders" },
  { to: "/profile", label: "Company profile" },
];

export default function Layout() {
  // Only matters on a phone: whether the menu is open.
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [firmName, setFirmName] = useState("");

  // Show the firm's name in the bar. If this fails the bar simply has no
  // name; the pages report their own errors.
  useEffect(() => {
    getMe()
      .then((user) => setFirmName(user.firm?.name ?? user.email))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        {/* flex-wrap lets the menu drop onto its own line on a phone. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 px-4 py-3">
          <Link to="/tenders" className="text-lg font-semibold">
            TenderSathi
          </Link>

          {/* The menu button. "sm:hidden" hides it on screens wider than a
              phone, where the links are always visible. */}
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium sm:hidden"
            // These two tell screen readers what the button controls and
            // whether the menu is open.
            aria-controls="main-menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? "Close menu" : "Menu"}
          </button>

          <nav
            id="main-menu"
            aria-label="Main"
            className={
              // Phone: a full-width column, shown only when open.
              (isMenuOpen ? "flex" : "hidden") +
              " w-full flex-col gap-1 pt-3 " +
              // Wider screens: always shown, in a row.
              "sm:flex sm:w-auto sm:flex-1 sm:flex-row sm:items-center sm:gap-2 sm:pt-0"
            }
          >
            {LINKS.map((link) => (
              // NavLink is a Link that knows whether it points at the
              // current page, so that page's link can be highlighted.
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setIsMenuOpen(false)} // close the menu after choosing
                className={({ isActive }) =>
                  "rounded-md px-3 py-2 text-sm font-medium " +
                  (isActive
                    ? "bg-slate-100 text-slate-900 underline underline-offset-4"
                    : "text-slate-700 hover:bg-slate-50")
                }
              >
                {link.label}
              </NavLink>
            ))}

            {/* sm:ml-auto pushes the firm name and logout to the right. */}
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 sm:mt-0 sm:ml-auto sm:border-0 sm:pt-0">
              <span className="text-sm text-slate-600">{firmName}</span>
              <LogoutButton />
            </div>
          </nav>
        </div>
      </header>

      {/* The page for the current address is drawn here. */}
      <Outlet />
    </div>
  );
}
