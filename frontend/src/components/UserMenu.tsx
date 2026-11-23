// UserMenu: the round avatar in the top-right corner. Clicking it opens a
// small menu with the account details, links and "Log out".
import { Building2, ChevronDown, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";
import ThemeSwitcher from "./ThemeSwitcher";

// "Rahman Builders Ltd" -> "RB"
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}

export default function UserMenu({ firmName, email }: { firmName: string; email: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Close the menu on a click outside it or on Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 text-xs font-semibold text-white">
          {initials(firmName || email || "?")}
        </span>
        <span className="hidden max-w-40 truncate text-sm font-medium text-fg-2 sm:block">
          {firmName || "Account"}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 text-fg-5" />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 origin-top-right rounded-xl bg-surface p-1.5 shadow-xl ring-1 ring-slate-900/10 dark:ring-white/10"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-fg">{firmName || "Your firm"}</p>
            <p className="truncate text-xs text-fg-4">{email}</p>
          </div>
          <div className="my-1 h-px bg-surface-subtle" />
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-sm text-fg-2">Theme</span>
            <ThemeSwitcher />
          </div>
          <div className="my-1 h-px bg-surface-subtle" />
          <Link
            role="menuitem"
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-2 hover:bg-surface-muted"
          >
            <Building2 aria-hidden="true" className="size-4 text-fg-5" />
            Company profile
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-2 hover:bg-surface-muted"
          >
            <LogOut aria-hidden="true" className="size-4 text-fg-5" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
