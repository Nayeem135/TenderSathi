// DashboardPage: the first page after logging in. It greets the firm,
// shows a few numbers, the result of the latest analysis as a chart, the
// four steps of using TenderSathi, and the latest tenders, so a user always
// knows where they stand and what to do next.
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  FileCheck2,
  FileText,
  ListChecks,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  errorMessage,
  getMe,
  getProfile,
  getReport,
  listContracts,
  listTenders,
  type CompanyProfile,
  type EligibilityReport,
  type PastContract,
  type Tender,
} from "../api";
import Card from "../components/Card";
import DonutChart, { VERDICT_COLORS } from "../components/DonutChart";
import EmptyState from "../components/EmptyState";
import Message from "../components/Message";
import Skeleton, { SkeletonRows } from "../components/Skeleton";
import StatusLabel from "../components/StatusLabel";
import TenderStatusBadge from "../components/TenderStatusBadge";
import { formatDate } from "../format";
import { profileCompleteness } from "../profileCompleteness";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// A number tile. `tone` picks the colour of the icon badge.
function StatCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  note: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fg-4">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
        </div>
        <span className={`flex size-11 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      </div>
      <p className="mt-3 text-sm text-fg-4">{note}</p>
    </div>
  );
}

type Step = { done: boolean; title: string; text: string; to: string; action: string };

function StepItem({ step, number }: { step: Step; number: number }) {
  return (
    <li className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      {step.done ? (
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-green-600" />
      ) : (
        <Circle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-fg-6" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${step.done ? "text-fg-5 line-through decoration-fg-6" : "text-fg"}`}>
          <span className="sr-only">{step.done ? "Done: " : "To do: "}</span>
          {number}. {step.title}
        </p>
        <p className="mt-0.5 text-sm text-fg-4">{step.text}</p>
      </div>
      {!step.done && (
        <Link
          to={step.to}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-medium text-accent hover:bg-accent-soft"
        >
          {step.action}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </li>
  );
}

// The result of the most recent analysis, as a donut chart.
function LatestReportCard({ report }: { report: EligibilityReport | null }) {
  if (!report || report.results.length === 0) {
    return (
      <Card title="Latest result" icon={<ListChecks aria-hidden="true" className="size-5" />}>
        <EmptyState icon={<ListChecks aria-hidden="true" className="size-6" />} title="No analysis yet">
          Analyze a tender and its result appears here.
        </EmptyState>
      </Card>
    );
  }
  const count = (status: string) => report.results.filter((item) => item.status === status).length;
  const met = count("met");
  const rows = [
    { status: "met" as const, value: met },
    { status: "not_met" as const, value: count("not_met") },
    { status: "needs_review" as const, value: count("needs_review") },
  ];
  return (
    <Card
      title="Latest result"
      description={report.tender.title}
      icon={<ListChecks aria-hidden="true" className="size-5" />}
      actions={
        <Link
          to={`/tenders/${report.tender.id}/report`}
          className="text-sm font-medium text-accent hover:underline"
        >
          Open report
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <DonutChart
          segments={rows.map((row) => ({ value: row.value, color: VERDICT_COLORS[row.status] }))}
          centerValue={`${met}/${report.results.length}`}
          centerLabel="conditions met"
        />
        <ul className="w-full space-y-2.5">
          {rows.map((row) => (
            <li key={row.status} className="flex items-center justify-between">
              <StatusLabel status={row.status} />
              <span className="font-semibold text-fg tabular-nums">{row.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [firmName, setFirmName] = useState("");
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [contracts, setContracts] = useState<PastContract[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [latestReport, setLatestReport] = useState<EligibilityReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Load everything the dashboard summarises, all at once; then the report
  // of the newest analyzed tender, if there is one.
  useEffect(() => {
    Promise.all([getMe(), getProfile(), listContracts(), listTenders()])
      .then(async ([me, loadedProfile, loadedContracts, loadedTenders]) => {
        setFirmName(me.firm?.name ?? "");
        setProfile(loadedProfile);
        setContracts(loadedContracts);
        setTenders(loadedTenders);
        const newest = loadedTenders.find((tender) => tender.status === "analyzed");
        if (newest) setLatestReport(await getReport(newest.id));
      })
      .catch((problem) => setError(errorMessage(problem)))
      .finally(() => setIsLoading(false));
  }, []);

  const completeness = profileCompleteness(profile);
  const analyzed = tenders.filter((tender) => tender.status === "analyzed");

  const steps: Step[] = [
    {
      done: completeness === 100,
      title: "Complete your company profile",
      text: `Turnover, liquid assets, experience and licences. ${completeness}% done.`,
      to: "/profile",
      action: "Open profile",
    },
    {
      done: contracts.length > 0,
      title: "Add your past contracts",
      text: 'Used to check "similar works" conditions.',
      to: "/profile#contracts",
      action: "Add contracts",
    },
    {
      done: tenders.length > 0,
      title: "Upload a tender document",
      text: "The PDF published by the procuring entity.",
      to: "/tenders",
      action: "Upload",
    },
    {
      done: analyzed.length > 0,
      title: "Analyze it and read the report",
      text: "See which conditions you meet, and why.",
      to: "/tenders",
      action: "Analyze",
    },
  ];
  const stepsDone = steps.filter((step) => step.done).length;

  return (
    <div className="space-y-6">
      {/* Welcome banner. */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 px-6 py-7 text-white shadow-lg shadow-brand-900/20 sm:px-8">
        {/* A faint grid and glow, purely decorative. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:28px_28px]"
        />
        <div aria-hidden="true" className="absolute -top-20 -right-10 size-72 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-brand-200">{greeting()}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {isLoading ? "Welcome" : firmName || "Welcome"}
            </h1>
            <p className="mt-2 max-w-xl text-brand-100">
              {stepsDone === steps.length
                ? "Everything is set up. Upload a new tender any time to check your eligibility."
                : `You have finished ${stepsDone} of ${steps.length} setup steps. Complete them to get accurate eligibility reports.`}
            </p>
          </div>
          <Link
            to="/tenders"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-sm hover:bg-brand-50"
          >
            <UploadCloud aria-hidden="true" className="size-4" />
            Upload a tender
          </Link>
        </div>
      </section>

      <Message kind="error">{error}</Message>

      <div className="grid gap-4 sm:grid-cols-3">
        {isLoading ? (
          [0, 1, 2].map((key) => <Skeleton key={key} className="h-36 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Tenders uploaded"
              value={tenders.length}
              note={tenders.length ? `Latest on ${formatDate(tenders[0].uploaded_at)}` : "None yet"}
              icon={<FileText aria-hidden="true" className="size-5" />}
              tone="bg-accent-soft text-accent"
            />
            <StatCard
              label="Tenders analyzed"
              value={analyzed.length}
              note={`${tenders.length - analyzed.length} waiting for analysis`}
              icon={<FileCheck2 aria-hidden="true" className="size-5" />}
              tone="bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300"
            />
            <StatCard
              label="Profile complete"
              value={`${completeness}%`}
              note={`${contracts.length} past contract${contracts.length === 1 ? "" : "s"} recorded`}
              icon={<Building2 aria-hidden="true" className="size-5" />}
              tone={completeness === 100 ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card
            title={stepsDone === steps.length ? "You're all set" : "Getting started"}
            description={`${stepsDone} of ${steps.length} steps done`}
            icon={<Sparkles aria-hidden="true" className="size-5" />}
          >
            {/* A thin bar showing how many steps are done. */}
            <div
              className="mb-5 h-2 overflow-hidden rounded-full bg-surface-subtle"
              role="progressbar"
              aria-label="Steps done"
              aria-valuenow={stepsDone}
              aria-valuemin={0}
              aria-valuemax={steps.length}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all"
                style={{ width: `${(stepsDone / steps.length) * 100}%` }}
              />
            </div>
            <ol className="divide-y divide-line-subtle">
              {steps.map((step, index) => (
                <StepItem key={step.title} step={step} number={index + 1} />
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {isLoading ? <Skeleton className="h-64 rounded-xl" /> : <LatestReportCard report={latestReport} />}

          <Card
            title="Recent tenders"
            icon={<FileText aria-hidden="true" className="size-5" />}
            actions={
              tenders.length > 0 && (
                <Link to="/tenders" className="text-sm font-medium text-accent hover:underline">
                  View all
                </Link>
              )
            }
            padded={false}
          >
            {isLoading ? (
              <SkeletonRows rows={2} label="Loading tenders…" />
            ) : tenders.length === 0 ? (
              <EmptyState icon={<FileText aria-hidden="true" className="size-6" />} title="No tenders yet">
                Upload a tender PDF to get started.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {tenders.slice(0, 5).map((tender) => (
                  <li key={tender.id}>
                    <Link
                      to={tender.status === "analyzed" ? `/tenders/${tender.id}/report` : "/tenders"}
                      className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{tender.title}</p>
                        <p className="text-xs text-fg-4">Uploaded {formatDate(tender.uploaded_at)}</p>
                      </div>
                      <TenderStatusBadge status={tender.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
