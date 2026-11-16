// ReportPage: the eligibility report for one tender (FR-12 to FR-14).
// A summary card on top, then every condition with its verdict and reason.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { errorMessage, getReport, type ReportItem } from "../api";
import Message from "../components/Message";
import StatusLabel from "../components/StatusLabel";

export default function ReportPage() {
  // The tender id comes from the address: /tenders/7/report -> "7".
  const { tenderId } = useParams();

  const [results, setResults] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Load the report when the page opens, and again if the id in the
  // address changes.
  useEffect(() => {
    setIsLoading(true);
    setError("");
    getReport(Number(tenderId))
      .then((report) => setResults(report.results))
      .catch((problem) => setError(errorMessage(problem)))
      .finally(() => setIsLoading(false));
  }, [tenderId]);

  // Count each kind of verdict for the summary card.
  const count = (status: string) => results.filter((item) => item.status === status).length;
  const met = count("met");
  const notMet = count("not_met");
  const needsReview = results.length - met - notMet;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <Link to="/tenders" className="text-sm font-medium text-blue-700 underline">
          ← Back to tenders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Eligibility report</h1>
      </div>

      <Message kind="error">{error}</Message>

      {isLoading ? (
        <p className="text-slate-600">Loading report…</p>
      ) : error ? null : results.length === 0 ? (
        <p className="text-slate-600">
          There is no report for this tender yet. Go back and click "Analyze" first.
        </p>
      ) : (
        <>
          {/* The summary card. */}
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <p className="text-3xl font-semibold text-slate-900">
              {met} of {results.length} conditions met
            </p>
            {/* The counts are written out in words; the labels below add colour. */}
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <StatusLabel status="met" /> {met}
              </li>
              <li className="flex items-center gap-2">
                <StatusLabel status="not_met" /> {notMet}
              </li>
              <li className="flex items-center gap-2">
                <StatusLabel status="needs_review" /> {needsReview}
              </li>
            </ul>
          </section>

          {/* One card per condition. */}
          <ul className="space-y-3">
            {results.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm text-slate-600">
                    <span className="capitalize">{item.category}</span>
                    {item.page !== null && ` · Page ${item.page}`}
                    {item.clause && ` · Clause ${item.clause}`}
                  </p>
                  <StatusLabel status={item.status} />
                </div>
                <p className="mt-2 text-slate-900">{item.text}</p>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-medium">Reason: </span>
                  {item.reason}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
