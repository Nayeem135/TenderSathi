// AuthShell: the frame around the login and register forms. On a wide
// screen, a brand panel on the left says what TenderSathi does and shows a
// preview of a report; on a phone only the form is shown, under the logo.
import { CheckCircle2, FileSearch, HelpCircle, ListChecks, ShieldCheck, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import DonutChart, { VERDICT_COLORS } from "./DonutChart";
import Logo from "./Logo";
import ThemeSwitcher from "./ThemeSwitcher";

const FEATURES = [
  { Icon: FileSearch, text: "Reads the tender PDF" },
  { Icon: ListChecks, text: "Checks every condition" },
  { Icon: ShieldCheck, text: "Explains each result" },
];

// A made-up example, only to show what a report looks like.
const PREVIEW_ROWS = [
  { Icon: CheckCircle2, tone: "text-green-600", text: "Average annual turnover ≥ 300 lakh" },
  { Icon: CheckCircle2, tone: "text-green-600", text: "5 years of general experience" },
  { Icon: XCircle, tone: "text-red-600 dark:text-red-400", text: "Liquid assets ≥ 75 lakh" },
  { Icon: HelpCircle, tone: "text-amber-500", text: "Valid trade licence" },
];

function ReportPreview() {
  return (
    <div aria-hidden="true" className="rounded-2xl bg-surface p-5 text-fg shadow-2xl shadow-brand-950/40 ring-1 ring-white/20">
      <div className="flex items-center gap-4">
        <DonutChart
          size={84}
          segments={[
            { value: 9, color: VERDICT_COLORS.met },
            { value: 1, color: VERDICT_COLORS.not_met },
            { value: 1, color: VERDICT_COLORS.needs_review },
          ]}
          centerValue="82%"
          centerLabel="met"
        />
        <div>
          <p className="text-xs font-medium text-fg-4">Road works, package 3</p>
          <p className="text-lg font-semibold tracking-tight">9 of 11 conditions met</p>
          <p className="text-sm font-medium text-red-600 dark:text-red-400">1 condition is not met</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 border-t border-line-subtle pt-4">
        {PREVIEW_ROWS.map(({ Icon, tone, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-sm text-fg-2">
            <Icon className={`size-4 shrink-0 ${tone}`} />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

type AuthShellProps = {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer: ReactNode;
};

export default function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 p-10 text-white lg:flex xl:p-14">
        {/* A faint grid and two glows, purely decorative. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <div aria-hidden="true" className="absolute -top-32 -right-24 size-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-40 -left-24 size-96 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative">
          <Logo inverted />
        </div>

        <div className="relative max-w-md">
          <p className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100 ring-1 ring-white/15">
            Tender eligibility, made simple
          </p>
          <h2 className="mt-5 text-4xl leading-tight font-semibold tracking-tight">
            Know if you qualify <span className="text-brand-300">before you bid.</span>
          </h2>
          <p className="mt-4 text-brand-100">
            Upload a tender document and see, condition by condition, whether your firm meets it
            and why.
          </p>
          <div className="mt-8">
            <ReportPreview />
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {FEATURES.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-2 text-sm text-brand-100">
                <Icon aria-hidden="true" className="size-4 text-brand-300" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-brand-300">Final year capstone project</p>
      </aside>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="absolute top-4 right-4">
          <ThemeSwitcher />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-fg">{title}</h1>
          <p className="mt-2 text-fg-3">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-fg-3">{footer}</p>
        </div>
      </main>
    </div>
  );
}
