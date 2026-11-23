// UploadTenderForm: picks a PDF (by dragging it onto the box or clicking to
// choose one), checks it, and uploads it (FR-09).
import { FileText, UploadCloud, X } from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";

import { ApiError, errorMessage, MAX_UPLOAD_MB, uploadTender, type Tender } from "../api";
import Button from "./Button";
import Field from "./Field";
import Message from "./Message";

type UploadTenderFormProps = {
  // Called with the new tender after a successful upload, so the page can
  // add it to its list.
  onUploaded: (tender: Tender) => void;
};

// Returns an error message for a file that should not be uploaded, or "".
function checkFile(file: File | null): string {
  if (file === null) return "Choose a PDF file to upload.";
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Only PDF files can be uploaded.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `The file is too large. The limit is ${MAX_UPLOAD_MB} MB.`;
  }
  return "";
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export default function UploadTenderForm({ onUploaded }: UploadTenderFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [fileError, setFileError] = useState("");
  const [serverError, setServerError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function choose(chosen: File | null) {
    setFile(chosen);
    setServerError("");
    // Check as soon as a file is picked, not only when the form is sent.
    setFileError(chosen ? checkFile(chosen) : "");
  }

  function clearFile() {
    choose(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); // stop the browser from opening the PDF itself
    setIsDragging(false);
    choose(event.dataTransfer.files[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");

    const problem = checkFile(file);
    setFileError(problem);
    if (problem !== "" || file === null) return;

    setIsUploading(true);
    try {
      const tender = await uploadTender(file, title);
      onUploaded(tender);
      clearFile();
      setTitle("");
    } catch (error) {
      // The server checks the file again and may refuse it.
      if (error instanceof ApiError && error.fieldErrors.file) {
        setFileError(error.fieldErrors.file);
      }
      setServerError(errorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* The drop area is the file input's label, so clicking anywhere on it
          opens the file picker, and keyboard users reach the input itself. */}
      <label
        htmlFor="tender-file"
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors " +
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 " +
          (fileError
            ? "border-red-300 dark:border-red-500/40 bg-red-50/50 dark:bg-red-500/5"
            : isDragging
              ? "border-brand-500 bg-accent-soft"
              : "border-line-strong bg-surface-muted hover:border-brand-500 hover:bg-accent-soft/50")
        }
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-surface text-accent shadow-sm ring-1 ring-line">
          <UploadCloud aria-hidden="true" className="size-6" />
        </span>
        <span className="mt-3 font-medium text-fg">
          <span className="text-accent">Click to choose a PDF</span> or drag it here
        </span>
        <span className="mt-1 text-sm text-fg-4">PDF only, up to {MAX_UPLOAD_MB} MB</span>
        <input
          ref={inputRef}
          id="tender-file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-invalid={fileError ? true : undefined}
          aria-describedby={fileError ? "tender-file-error" : undefined}
          onChange={(event) => choose(event.target.files?.[0] ?? null)}
        />
      </label>

      {fileError && (
        <p id="tender-file-error" className="text-sm text-red-700 dark:text-red-400">
          {fileError}
        </p>
      )}

      {/* The chosen file, with a button to remove it. */}
      {file && !fileError && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
          <FileText aria-hidden="true" className="size-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{file.name}</p>
            <p className="text-xs text-fg-4">{formatSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="rounded-md p-1 text-fg-4 hover:bg-surface-subtle hover:text-fg-2"
            aria-label={`Remove ${file.name}`}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}

      <Field
        label="Title (optional)"
        name="title"
        value={title}
        placeholder="e.g. Upazila road works, package 3"
        onChange={(event) => setTitle(event.target.value)}
        hint="Leave empty to use the file name."
      />

      <Message kind="error">{serverError}</Message>

      <Button
        type="submit"
        isLoading={isUploading}
        icon={<UploadCloud aria-hidden="true" className="size-4" />}
        className="w-full sm:w-auto"
      >
        {isUploading ? "Uploading…" : "Upload tender"}
      </Button>
    </form>
  );
}
