// Layout: the frame shared by every page after login.
//
// - A dark sidebar on the left with the navigation (wide screens).
// - A top bar with breadcrumbs ("Tenders › Report") and the account menu.
// - On a phone the sidebar is hidden; a menu button in the top bar slides
//   it in over the page.
import { Building2, ChevronRight, FileText, LayoutDashboard, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { getMe, USE_MOCKS } from "../api";
import Logo from "./Logo";
import { ThemeToggle } from "./ThemeSwitcher";
import UserMenu from "./UserMenu";

// The pages in the menu. To add a page to the navigation, add a line here.
const LINKS = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/tenders", label: "Tenders", Icon: FileText, end: false },
  { to: "/profile", label: "Company profile", Icon: Building2, end: false },
];

// The breadcrumb trail for an address: where the user is, and how they got there.
function breadcrumbs(pathname: string): { label: string; to?: string }[] {
  if (pathname === "/") return [{ label: "Dashboard" }];
  if (pathname === "/tenders") return [{ label: "Tenders" }];
  if (/^\/tenders\/\d+\/report$/.test(pathname)) {
    return [{ label: "Tenders", to: "/tenders" }, { label: "Eligibility report" }];
  }
  if (pathname === "/profile") return [{ label: "Company profile" }];
  return [];
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-slate-900">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to="/" aria-label="TenderSathi home" onClick={onNavigate}>
          <Logo inverted />
        </Link>
      </div>
      <nav aria-label="Main" className="flex-1 px-3 py-4">
        <p className="px-3 pb-2 text-xs font-medium tracking-wider text-slate-500 uppercase">Menu</p>
        <ul className="space-y-1">
          {LINKS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              {/* NavLink knows whether it points at the current page, so that
                  link is highlighted; it also sets aria-current for screen readers. */}
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                  (isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white")
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      aria-hidden="true"
                      className={`size-5 shrink-0 ${isActive ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300"}`}
                    />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {/* A small help card at the bottom of the sidebar. */}
      <div className="m-3 rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 p-4 text-white">
        <p className="text-sm font-semibold">How it works</p>
        <p className="mt-1 text-xs leading-relaxed text-brand-100">
          Fill in your profile, upload a tender PDF, click Analyze, and read the report.
        </p>
      </div>
    </div>
  );
}

export default function Layout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [firmName, setFirmName] = useState("");
  const [email, setEmail] = useState("");
  const location = useLocation();

  // Show the firm's name in the account menu. If this fails the space
  // stays empty; the pages report their own errors.
  useEffect(() => {
    getMe()
      .then((user) => {
        setFirmName(user.firm?.name ?? "");
        setEmail(user.email);
      })
      .catch(() => {});
  }, []);

  // Close the phone menu whenever the page changes, or on Escape.
  useEffect(() => setIsMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setIsMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

  const trail = breadcrumbs(location.pathname);

  return (
    <div className="min-h-screen">
      {/* Sidebar: always shown on wide screens (lg and up). */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Sidebar on a phone: slides in over the page when the menu is open. */}
      {isMenuOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" id="mobile-menu">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setIsMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-2xl">
            <Sidebar onNavigate={() => setIsMenuOpen(false)} />
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1.5 text-fg-5 hover:bg-white/10 hover:text-white"
            >
              <X aria-hidden="true" className="size-5" />
              <span className="sr-only">Close menu</span>
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar: breadcrumbs on the left, account menu on the right. */}
        <header className="no-print sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="-ml-1 rounded-md p-2 text-fg-3 hover:bg-surface-subtle lg:hidden"
              aria-controls="mobile-menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(true)}
            >
              <Menu aria-hidden="true" className="size-5" />
              <span className="sr-only">Open menu</span>
            </button>

            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-1.5 text-sm">
                {trail.map((crumb, index) => (
                  <li key={crumb.label} className="flex min-w-0 items-center gap-1.5">
                    {index > 0 && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-6" />}
                    {crumb.to ? (
                      <Link to={crumb.to} className="truncate text-fg-4 hover:text-fg">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="truncate font-medium text-fg">
                        {crumb.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>

            <ThemeToggle />
            <UserMenu firmName={firmName} email={email} />
          </div>
        </header>

        {/* A reminder that nothing here is real data or reaches the backend. */}
        {USE_MOCKS && (
          <p className="no-print border-b border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-200">
            <span className="font-semibold">Mock data: </span>
            the backend is not being used (VITE_USE_MOCKS=true).
          </p>
        )}

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {/* The page for the current address is drawn here. */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
