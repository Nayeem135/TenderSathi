// PastContracts: the table of the firm's past contracts, with a form to
// add one and a button to delete one (FR-02).
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

import {
  ApiError,
  addContract,
  deleteContract,
  errorMessage,
  listContracts,
  type PastContract,
} from "../api";
import { formatLakhCrore, formatMoney } from "../format";
import { isValid, validateMoney, validateRequired, validateWholeNumber } from "../validation";
import Button from "./Button";
import Card from "./Card";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./EmptyState";
import Field from "./Field";
import Message from "./Message";
import { SkeletonRows } from "./Skeleton";

const FIRST_YEAR = 1990;
const THIS_YEAR = new Date().getFullYear();

const EMPTY_FORM = { title: "", client: "", type: "", value: "", year: "" };
type FormValues = typeof EMPTY_FORM;

export default function PastContracts() {
  const [contracts, setContracts] = useState<PastContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormValues>>({});
  const [isAdding, setIsAdding] = useState(false);
  // The id of the contract being deleted, to disable just that row's button.
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [serverError, setServerError] = useState("");
  // The contract waiting for "Delete" to be confirmed in the dialog.
  const [toDelete, setToDelete] = useState<PastContract | null>(null);
  // The add form is hidden until "Add contract" is clicked.
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Fetch the list from the server. Used when the page opens and again
  // after adding, so the table always shows what is really saved.
  async function loadContracts() {
    try {
      setContracts(await listContracts());
    } catch (problem) {
      setServerError(errorMessage(problem));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadContracts();
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function closeForm() {
    setIsFormOpen(false);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setServerError("");

    const found = {
      title: validateRequired(form.title, "Title"),
      value: validateMoney(form.value, "Value", true),
      year: validateWholeNumber(form.year, "Year", FIRST_YEAR, THIS_YEAR, true),
    };
    setErrors(found);
    if (!isValid(found)) return;

    setIsAdding(true);
    try {
      await addContract({
        title: form.title.trim(),
        client: form.client.trim() || null,
        type: form.type.trim() || null,
        value: form.value.trim(),
        year: Number(form.year),
      });
      toast.success("Contract added", { description: form.title.trim() });
      closeForm(); // clear and hide the form
      await loadContracts();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors);
      setServerError(errorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  // Runs when "Delete" is confirmed in the dialog.
  async function handleDelete(contract: PastContract) {
    setServerError("");
    setDeletingId(contract.id);
    try {
      await deleteContract(contract.id);
      // Remove it from the list on screen without asking the server again.
      setContracts(contracts.filter((item) => item.id !== contract.id));
      toast.success("Contract deleted", { description: contract.title });
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setDeletingId(null);
      setToDelete(null);
    }
  }

  const valueInWords = formatLakhCrore(form.value);

  return (
    <Card
      title="Past contracts"
      description='Completed works. Used for "similar contracts" conditions.'
      icon={<Briefcase aria-hidden="true" className="size-5" />}
      actions={
        !isFormOpen && (
          <Button
            size="sm"
            icon={<Plus aria-hidden="true" className="size-4" />}
            onClick={() => setIsFormOpen(true)}
          >
            Add contract
          </Button>
        )
      }
      padded={false}
    >
      {serverError && (
        <div className="px-5 pt-5">
          <Message kind="error">{serverError}</Message>
        </div>
      )}

      {isFormOpen && (
        <form
          onSubmit={handleAdd}
          noValidate
          className="space-y-5 border-b border-line-subtle bg-surface-muted/60 px-5 py-5"
        >
          <h3 className="font-medium text-fg">Add a past contract</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Title"
              name="title"
              value={form.title}
              onChange={handleChange}
              error={errors.title}
              placeholder="e.g. Bridge approach road"
            />
            <Field
              label="Client (optional)"
              name="client"
              value={form.client}
              onChange={handleChange}
              error={errors.client}
              placeholder="e.g. LGED"
            />
            <Field
              label="Type of work (optional)"
              name="type"
              value={form.type}
              onChange={handleChange}
              error={errors.type}
              placeholder="e.g. Road construction"
            />
            <Field
              label="Value"
              name="value"
              inputMode="decimal"
              prefix="Tk"
              value={form.value}
              onChange={handleChange}
              error={errors.value}
              hint={
                valueInWords ? (
                  <>
                    = <span className="font-medium text-fg-2">{valueInWords}</span>
                  </>
                ) : (
                  "Full amount in taka, for example 20000000"
                )
              }
            />
            <Field
              label="Year completed"
              name="year"
              inputMode="numeric"
              value={form.year}
              onChange={handleChange}
              error={errors.year}
              hint={`Between ${FIRST_YEAR} and ${THIS_YEAR}`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" isLoading={isAdding} icon={<Plus aria-hidden="true" className="size-4" />}>
              {isAdding ? "Adding…" : "Save contract"}
            </Button>
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <SkeletonRows rows={2} label="Loading contracts…" />
      ) : contracts.length === 0 ? (
        <EmptyState icon={<Briefcase aria-hidden="true" className="size-6" />} title="No past contracts yet">
          Add the works your firm has completed. Tenders often ask for a number of similar works above
          a certain value.
        </EmptyState>
      ) : (
        // overflow-x-auto lets a wide table scroll sideways on a phone
        // instead of breaking the page. "relative" keeps the hidden
        // "Actions" label inside this box, so it cannot widen the page.
        <div className="relative overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-muted text-xs tracking-wide text-fg-4 uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Title</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">Value</th>
                <th className="px-5 py-3 font-medium">Year</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {contracts.map((contract) => (
                // key tells React which row is which when the list changes.
                <tr key={contract.id} className="hover:bg-surface-muted/60">
                  <td className="min-w-48 px-5 py-3 font-medium text-fg">{contract.title}</td>
                  <td className="px-5 py-3 text-fg-3">{contract.client ?? "—"}</td>
                  <td className="px-5 py-3 text-fg-3">{contract.type ?? "—"}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap tabular-nums">
                    <span className="text-fg">Tk {formatMoney(contract.value)}</span>
                    <span className="block text-xs text-fg-4">{formatLakhCrore(contract.value)}</span>
                  </td>
                  <td className="px-5 py-3 text-fg-3 tabular-nums">{contract.year}</td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      isLoading={deletingId === contract.id}
                      icon={<Trash2 aria-hidden="true" className="size-4" />}
                      // Deleting cannot be undone, so ask first.
                      onClick={() => setToDelete(contract)}
                      aria-label={`Delete ${contract.title}`}
                      className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this contract?"
        message={`"${toDelete?.title ?? ""}" will be removed from your profile. This cannot be undone.`}
        confirmLabel="Delete contract"
        isWorking={deletingId !== null}
        onConfirm={() => toDelete && handleDelete(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </Card>
  );
}
