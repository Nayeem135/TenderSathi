// PastContracts: the table of the firm's past contracts, with a form to
// add one and a button to delete one (FR-02).
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

import {
  ApiError,
  addContract,
  deleteContract,
  errorMessage,
  listContracts,
  type PastContract,
} from "../api";
import { formatMoney } from "../format";
import { isValid, validateMoney, validateRequired, validateWholeNumber } from "../validation";
import Button from "./Button";
import Field from "./Field";
import Message from "./Message";

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
      setForm(EMPTY_FORM); // clear the form for the next one
      await loadContracts();
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fieldErrors);
      setServerError(errorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(contract: PastContract) {
    // Deleting cannot be undone, so ask first.
    if (!window.confirm(`Delete the contract "${contract.title}"?`)) return;

    setServerError("");
    setDeletingId(contract.id);
    try {
      await deleteContract(contract.id);
      // Remove it from the list on screen without asking the server again.
      setContracts(contracts.filter((item) => item.id !== contract.id));
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Message kind="error">{serverError}</Message>

      {isLoading ? (
        <p className="text-slate-600">Loading contracts…</p>
      ) : contracts.length === 0 ? (
        <p className="text-slate-600">No past contracts added yet.</p>
      ) : (
        // overflow-x-auto lets a wide table scroll sideways on a phone
        // instead of breaking the page. "relative" keeps the hidden
        // "Actions" label inside this box, so it cannot widen the page.
        <div className="relative overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Year</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                // key tells React which row is which when the list changes.
                <tr key={contract.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{contract.title}</td>
                  <td className="px-3 py-2">{contract.client ?? "—"}</td>
                  <td className="px-3 py-2">{contract.type ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(contract.value)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{contract.year}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="danger"
                      disabled={deletingId === contract.id}
                      onClick={() => handleDelete(contract)}
                      aria-label={`Delete ${contract.title}`}
                    >
                      {deletingId === contract.id ? "Deleting…" : "Delete"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleAdd} noValidate className="space-y-4 rounded-md border border-slate-200 p-4">
        <h3 className="font-medium text-slate-900">Add a past contract</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Title"
            name="title"
            value={form.title}
            onChange={handleChange}
            error={errors.title}
          />
          <Field
            label="Client (optional)"
            name="client"
            value={form.client}
            onChange={handleChange}
            error={errors.client}
          />
          <Field
            label="Type of work (optional)"
            name="type"
            value={form.type}
            onChange={handleChange}
            error={errors.type}
            hint="For example: Road construction"
          />
          <Field
            label="Value"
            name="value"
            inputMode="decimal"
            value={form.value}
            onChange={handleChange}
            error={errors.value}
            hint="Full amount, for example 20000000"
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
        <Button type="submit" disabled={isAdding}>
          {isAdding ? "Adding…" : "Add contract"}
        </Button>
      </form>
    </div>
  );
}
