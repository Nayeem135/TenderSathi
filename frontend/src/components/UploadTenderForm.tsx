// UploadTenderForm: picks a PDF, checks it, and uploads it (FR-09).
import { useState, type ChangeEvent, type FormEvent } from "react";

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

export default function UploadTenderForm({ onUploaded }: UploadTenderFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [fileError, setFileError] = useState("");
  const [serverError, setServerError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    // A file input gives a list; this form only takes the first file.
    const chosen = event.target.files?.[0] ?? null;
    setFile(chosen);
    // Check as soon as a file is picked, not only when the form is sent.
    setFileError(chosen ? checkFile(chosen) : "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget; // kept for clearing the form later
    setServerError("");

    const problem = checkFile(file);
    setFileError(problem);
    if (problem !== "" || file === null) return;

    setIsUploading(true);
    try {
      const tender = await uploadTender(file, title);
      onUploaded(tender);
      // Clear the form. A file input can only be emptied by resetting the form.
      formElement.reset();
      setFile(null);
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
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-md border border-slate-200 p-4">
      <h2 className="font-medium text-slate-900">Upload a tender</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Tender document (PDF)"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleFileChange}
          error={fileError}
          hint={`PDF only, up to ${MAX_UPLOAD_MB} MB`}
        />
        <Field
          label="Title (optional)"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          hint="Leave empty to use the file name"
        />
      </div>
      <Message kind="error">{serverError}</Message>
      <Button type="submit" disabled={isUploading}>
        {isUploading ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
