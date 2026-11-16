// TendersPage: upload tenders, list them, analyze one, and see its
// conditions (FR-09 to FR-11).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  analyzeTender,
  errorMessage,
  getConditions,
  listTenders,
  type Condition,
  type Tender,
} from "../api";
import Button from "../components/Button";
import ConditionsTable from "../components/ConditionsTable";
import Message from "../components/Message";
import UploadTenderForm from "../components/UploadTenderForm";
import { formatDate } from "../format";

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // The tender whose conditions are shown under the list, if any.
  const [selected, setSelected] = useState<Tender | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  // The id of the tender that is busy, and what it is busy with. Only one
  // tender is worked on at a time, so the other buttons are disabled.
  const [busy, setBusy] = useState<{ id: number; doing: "analyzing" | "loading" } | null>(null);

  async function loadTenders() {
    try {
      setTenders(await listTenders());
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTenders();
  }, []);

  // Show the conditions already saved for a tender.
  async function handleView(tender: Tender) {
    setError("");
    setBusy({ id: tender.id, doing: "loading" });
    try {
      setConditions(await getConditions(tender.id));
      setSelected(tender);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  }

  // Run the analysis, then show the conditions it found.
  async function handleAnalyze(tender: Tender) {
    setError("");
    setBusy({ id: tender.id, doing: "analyzing" });
    try {
      await analyzeTender(tender.id);
      setConditions(await getConditions(tender.id));
      setSelected(tender);
      await loadTenders(); // the tender's status may have changed
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Tenders</h1>

      {/* The new tender goes to the top of the list. */}
      <UploadTenderForm onUploaded={(tender) => setTenders([tender, ...tenders])} />

      <Message kind="error">{error}</Message>

      {/* aria-live makes screen readers announce the text when it appears. */}
      <p aria-live="polite" className="text-sm text-slate-600">
        {busy?.doing === "analyzing"
          ? "Analyzing the tender. This can take a minute for a long document…"
          : ""}
      </p>

      <section>
        <h2 className="text-xl font-semibold text-slate-900">Your tenders</h2>
        <div className="mt-4">
          {isLoading ? (
            <p className="text-slate-600">Loading tenders…</p>
          ) : tenders.length === 0 ? (
            <p className="text-slate-600">No tenders uploaded yet.</p>
          ) : (
            // "relative" keeps the hidden "Actions" label inside this box,
            // so it cannot widen the page on a phone.
            <div className="relative overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Uploaded</th>
                    <th className="px-3 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenders.map((tender) => (
                    <tr key={tender.id} className="border-t border-slate-200">
                      <td className="min-w-48 px-3 py-2">{tender.title}</td>
                      <td className="px-3 py-2 capitalize">{tender.status}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(tender.uploaded_at)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/tenders/${tender.id}/report`}
                            className="px-2 text-sm font-medium whitespace-nowrap text-blue-700 underline"
                          >
                            Report
                          </Link>
                          <Button
                            variant="secondary"
                            disabled={busy !== null}
                            onClick={() => handleView(tender)}
                          >
                            {busy?.id === tender.id && busy.doing === "loading"
                              ? "Loading…"
                              : "Conditions"}
                          </Button>
                          <Button disabled={busy !== null} onClick={() => handleAnalyze(tender)}>
                            {busy?.id === tender.id && busy.doing === "analyzing"
                              ? "Analyzing…"
                              : "Analyze"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {selected && (
        <section>
          <h2 className="text-xl font-semibold text-slate-900">
            Conditions in "{selected.title}"
          </h2>
          <div className="mt-4">
            <ConditionsTable conditions={conditions} />
          </div>
        </section>
      )}
    </main>
  );
}
