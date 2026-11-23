// Saves an eligibility report as a CSV file, which opens in Excel or
// Google Sheets, so the report can be shared, filtered or annotated.
import type { ReportItem } from "./api";
import { formatCategory } from "./format";

const STATUS_TEXT = { met: "Met", not_met: "Not met", needs_review: "Needs review" };

// One CSV cell: wrapped in quotes, with any quote inside doubled, so commas
// and line breaks in the text cannot break the columns.
function cell(value: string | number | null): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function reportToCsv(results: ReportItem[]): string {
  const header = ["Result", "Category", "Condition", "Page", "Clause", "Reason"];
  const rows = results.map((item) => [
    STATUS_TEXT[item.status] ?? item.status,
    formatCategory(item.category),
    item.text,
    item.page,
    item.clause,
    item.reason,
  ]);
  return [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}

// "Road works, package 3" -> "eligibility-report-road-works-package-3.csv"
export function csvFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `eligibility-report${slug ? `-${slug}` : ""}.csv`;
}

export function downloadCsv(fileName: string, csv: string): void {
  // The "﻿" mark at the start tells Excel the file is UTF-8, so
  // non-English text (such as Bangla) shows correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
