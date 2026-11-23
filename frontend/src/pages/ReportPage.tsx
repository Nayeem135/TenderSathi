// ReportPage: the eligibility report for one tender (FR-12 to FR-14).
// A summary card on top, then every condition with its verdict and reason,
// which can be filtered by verdict and printed.
import { Download, FileSearch, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import {
  errorMessage,
  getReport,
  type EligibilityStatus,
  type ReportItem,
  type Tender,
} from "../api";
import Button from "../components/Button";
import Card from "../components/Card";
import DonutChart, { VERDICT_COLORS } from "../components/DonutChart";
import EmptyState from "../components/EmptyState";
import Message from "../components/Message";
import PageHeader from "../components/PageHeader";
import Skeleton from "../components/Skeleton";
import StatusLabel, { STATUS_LOOKS } from "../components/StatusLabel";
import { csvFileName, downloadCsv, reportToCsv } from "../exportCsv";
import { formatCategory, formatDate } from "../format";

type Filter = "all" | EligibilityStatus;

// The order verdicts are listed in: problems first.
const ORDER: EligibilityStatus[] = ["not_met", "needs_review", "met"];

function SummaryCard({ results }: { results: ReportItem[] }) {
  const total = results.length;
  const count = (status: EligibilityStatus) => results.filter((item) => item.status === status).length;
  const met = count("met");
  const notMet = count("not_met");
  const verdict =
    notMet > 0
      ? { text: `${notMet} condition${notMet === 1 ? " is" : "s are"} not met`, tone: "text-red-700 dark:text-red-400" }
      : met === total
        ? { text: "Every condition is met", tone: "text-green-700 dark:text-green-400" }
        : { text: "No condition is failed, but some need review", tone: "text-amber-700 dark:text-amber-300" };

  return (
    <Card>
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        {/* The chart is decorative; the written counts beside it carry the
            same information for anyone who cannot see colour. */}
        <DonutChart
          segments={(["met", "not_met", "needs_review"] as const).map((status) => ({
            value: count(status),
            color: VERDICT_COLORS[status],
          }))}
          centerValue={`${Math.round((met / Math.max(total, 1)) * 100)}%`}
          centerLabel="met"
          size={156}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg-4">Eligibility summary</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-fg">
            {met} of {total} conditions met
          </p>
          <p className={`mt-1 font-medium ${verdict.tone}`}>{verdict.text}</p>

          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {(["met", "not_met", "needs_review"] as const).map((status) => (
              <li
                key={status}
                className="flex items-center justify-between rounded-lg bg-surface-muted px-3.5 py-2.5 ring-1 ring-line/70"
              >
                <StatusLabel status={status} />
                <span className="text-lg font-semibold text-fg tabular-nums">{count(status)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

export default function ReportPage() {
  // The tender id comes from the address: /tenders/7/report -> "7".
  const { tenderId } = useParams();

  const [tender, setTender] = useState<Tender | null>(null);
  const [results, setResults] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Load the report when the page opens, and again if the id in the
  // address changes.
  useEffect(() => {
    setIsLoading(true);
    setError("");
    getReport(Number(tenderId))
      .then((report) => {
        setTender(report.tender ?? null);
        setResults(report.results);
      })
      .catch((problem) => setError(errorMessage(problem)))
      .finally(() => setIsLoading(false));
  }, [tenderId]);

  // Problems first, then in document order within each verdict.
  const sorted = [...results].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.id - b.id,
  );
  const shown = filter === "all" ? sorted : sorted.filter((item) => item.status === filter);
  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "not_met", label: "Not met" },
    { value: "needs_review", label: "Needs review" },
    { value: "met", label: "Met" },
  ];

  return (
    <>
      <PageHeader
        title="Eligibility report"
        description={
          tender ? (
            <>
              <span className="font-medium text-fg">{tender.title}</span>
              <span className="text-fg-5"> · </span>uploaded {formatDate(tender.uploaded_at)}
            </>
          ) : undefined
        }
        actions={
          results.length > 0 && (
            <>
              <Button
                variant="secondary"
                icon={<Download aria-hidden="true" className="size-4" />}
                onClick={() => {
                  // In document order, like the tender itself.
                  const inOrder = [...results].sort((a, b) => a.id - b.id);
                  downloadCsv(csvFileName(tender?.title ?? ""), reportToCsv(inOrder));
                  toast.success("Report exported", { description: "Open the CSV file in Excel or Google Sheets." });
                }}
              >
                Export to Excel
              </Button>
              <Button
                variant="secondary"
                icon={<Printer aria-hidden="true" className="size-4" />}
                onClick={() => window.print()}
              >
                Print / Save as PDF
              </Button>
            </>
          )
        }
      />

      <Message kind="error">{error}</Message>

      {isLoading ? (
        <div role="status" className="space-y-4">
          <span className="sr-only">Loading report…</span>
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : error ? null : results.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileSearch aria-hidden="true" className="size-6" />}
            title="No report for this tender yet"
            action={
              <Link
                to="/tenders"
                className="inline-flex items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
              >
                Go to tenders
              </Link>
            }
          >
            Go back to the tenders page and click "Analyze" on this tender first.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-6">
          <SummaryCard results={results} />

          <section aria-labelledby="conditions-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="conditions-heading" className="text-lg font-semibold text-fg">
                Conditions
              </h2>
              {/* Filter buttons. aria-pressed tells screen readers which is on. */}
              <div
                className="no-print flex max-w-full gap-1 overflow-x-auto rounded-lg bg-surface-subtle p-1 whitespace-nowrap"
                role="group"
                aria-label="Show"
              >
                {filters.map(({ value, label }) => {
                  const number = value === "all" ? results.length : results.filter((r) => r.status === value).length;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                      className={
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                        (filter === value
                          ? "bg-surface text-fg shadow-sm"
                          : "text-fg-3 hover:text-fg")
                      }
                    >
                      {label} <span className="text-fg-5 tabular-nums">{number}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {shown.length === 0 ? (
              <Card>
                <p className="text-center text-fg-4">No conditions with this result.</p>
              </Card>
            ) : (
              <ul className="space-y-3">
                {shown.map((item) => (
                  <li
                    key={item.id}
                    className={`rounded-xl border border-l-4 border-line bg-surface p-5 shadow-sm transition-shadow hover:shadow-md break-inside-avoid ${STATUS_LOOKS[item.status]?.accent ?? ""}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-fg-4">
                        <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-medium text-fg-2">
                          {formatCategory(item.category)}
                        </span>
                        {item.page !== null && <span>Page {item.page}</span>}
                        {item.clause && <span>· Clause {item.clause}</span>}
                      </div>
                      <StatusLabel status={item.status} />
                    </div>
                    <p className="mt-3 text-fg">{item.text}</p>
                    <p className="mt-3 rounded-lg bg-surface-muted px-3.5 py-2.5 text-sm text-fg-2">
                      <span className="font-medium text-fg">Why: </span>
                      {item.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
