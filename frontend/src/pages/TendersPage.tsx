// TendersPage: upload tenders, list them, analyze one, and see its
// conditions (FR-09 to FR-11).
import { ArrowRight, FileSearch, FileText, Search, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import {
  analyzeTender,
  deleteTender,
  errorMessage,
  getConditions,
  listTenders,
  type Condition,
  type Tender,
} from "../api";
import Button from "../components/Button";
import Card from "../components/Card";
import ConditionsTable from "../components/ConditionsTable";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import Message from "../components/Message";
import PageHeader from "../components/PageHeader";
import { SkeletonRows } from "../components/Skeleton";
import Spinner from "../components/Spinner";
import TenderStatusBadge from "../components/TenderStatusBadge";
import UploadTenderForm from "../components/UploadTenderForm";
import { formatDate } from "../format";

export default function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // The tender waiting for "Delete" to be confirmed, and whether it is being deleted.
  const [toDelete, setToDelete] = useState<Tender | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // The text typed in the search box above the list.
  const [search, setSearch] = useState("");

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
      const found = await getConditions(tender.id);
      setConditions(found);
      setSelected(tender);
      toast.success(`"${tender.title}" analyzed`, {
        description: `${found.length} conditions found. Open the report to see which ones you meet.`,
      });
      await loadTenders(); // the tender's status has changed
    } catch (problem) {
      setError(errorMessage(problem));
      await loadTenders(); // it may now say "Analysis failed"
    } finally {
      setBusy(null);
    }
  }

  // Runs when "Delete" is confirmed in the dialog.
  async function handleDelete(tender: Tender) {
    setError("");
    setIsDeleting(true);
    try {
      await deleteTender(tender.id);
      setTenders(tenders.filter((item) => item.id !== tender.id));
      if (selected?.id === tender.id) setSelected(null);
      toast.success("Tender deleted", { description: tender.title });
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setIsDeleting(false);
      setToDelete(null);
    }
  }

  const shownTenders = tenders.filter((tender) =>
    tender.title.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Tenders"
        description="Upload a tender document, analyze it, and open the eligibility report."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-1 lg:self-start"
          title="Upload a tender"
          icon={<UploadCloud aria-hidden="true" className="size-5" />}
        >
          {/* The new tender goes to the top of the list. */}
          <UploadTenderForm
            onUploaded={(tender) => {
              setTenders([tender, ...tenders]);
              setError("");
              toast.success(`"${tender.title}" uploaded`, { description: 'Click "Analyze" to check it.' });
            }}
          />
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Message kind="error">{error}</Message>

          {/* aria-live makes screen readers announce the text when it appears. */}
          {/* empty:hidden: takes no space while there is nothing to say. */}
          <div aria-live="polite" className="empty:hidden">
            {busy?.doing === "analyzing" && (
              <div className="flex items-center gap-3 rounded-lg border border-accent-line bg-accent-soft px-4 py-3 text-sm text-accent-strong">
                <Spinner className="size-5 text-accent" />
                <span>
                  <span className="font-semibold">Analyzing the tender.</span> Reading the PDF and
                  checking each condition against your profile. This can take a minute for a long
                  document…
                </span>
              </div>
            )}
          </div>

          <Card
            title="Your tenders"
            description={tenders.length > 0 ? `${tenders.length} uploaded` : undefined}
            actions={
              tenders.length > 1 && (
                <div className="relative w-full sm:w-56">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-5"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tenders"
                    aria-label="Search tenders"
                    className="w-full rounded-lg bg-surface-muted py-1.5 pr-3 pl-9 text-sm ring-1 ring-line placeholder:text-fg-5 focus:bg-surface focus:ring-2 focus:ring-brand-600/30 focus:outline-none"
                  />
                </div>
              )
            }
            icon={<FileText aria-hidden="true" className="size-5" />}
            padded={false}
          >
            {isLoading ? (
              <SkeletonRows rows={3} label="Loading tenders…" />
            ) : tenders.length === 0 ? (
              <EmptyState icon={<FileText aria-hidden="true" className="size-6" />} title="No tenders yet">
                Upload your first tender document using the form.
              </EmptyState>
            ) : shownTenders.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-fg-4">No tenders match "{search}".</p>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {shownTenders.map((tender) => {
                  const isBusy = busy?.id === tender.id;
                  return (
                    <li
                      key={tender.id}
                      className={
                        "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between " +
                        (selected?.id === tender.id ? "bg-accent-soft/40" : "")
                      }
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                          <FileText aria-hidden="true" className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{tender.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-4">
                            <TenderStatusBadge status={tender.status} />
                            <span>Uploaded {formatDate(tender.uploaded_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        {tender.status === "analyzed" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy !== null}
                              isLoading={isBusy && busy.doing === "loading"}
                              icon={<FileSearch aria-hidden="true" className="size-4" />}
                              onClick={() => handleView(tender)}
                            >
                              Conditions
                            </Button>
                            <Link
                              to={`/tenders/${tender.id}/report`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-surface-muted"
                            >
                              Report
                              <ArrowRight aria-hidden="true" className="size-4" />
                            </Link>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant={tender.status === "analyzed" ? "secondary" : "primary"}
                          disabled={busy !== null}
                          isLoading={isBusy && busy.doing === "analyzing"}
                          icon={<Sparkles aria-hidden="true" className="size-4" />}
                          onClick={() => handleAnalyze(tender)}
                        >
                          {isBusy && busy.doing === "analyzing"
                            ? "Analyzing…"
                            : tender.status === "analyzed"
                              ? "Re-analyze"
                              : "Analyze"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          icon={<Trash2 aria-hidden="true" className="size-4" />}
                          onClick={() => setToDelete(tender)}
                          aria-label={`Delete ${tender.title}`}
                          className="text-fg-4 hover:text-red-600 dark:hover:text-red-400"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {selected && (
            <Card
              title={`Conditions in "${selected.title}"`}
              description={`${conditions.length} found, in the order they appear in the document`}
              icon={<FileSearch aria-hidden="true" className="size-5" />}
              actions={
                <Link
                  to={`/tenders/${selected.id}/report`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                >
                  Open report
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              }
              padded={false}
            >
              <ConditionsTable conditions={conditions} />
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this tender?"
        message={`"${toDelete?.title ?? ""}", its conditions and its report will be deleted. This cannot be undone.`}
        confirmLabel="Delete tender"
        isWorking={isDeleting}
        onConfirm={() => toDelete && handleDelete(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
