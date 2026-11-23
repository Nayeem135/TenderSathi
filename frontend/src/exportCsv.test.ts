// Checks that the exported report is a well-formed CSV file.
import { describe, expect, it } from "vitest";

import type { ReportItem } from "./api";
import { csvFileName, reportToCsv } from "./exportCsv";

const item = (overrides: Partial<ReportItem>): ReportItem => ({
  id: 1,
  category: "turnover",
  text: "Turnover of at least 300 lakh",
  page: 5,
  clause: "4.3(a)",
  status: "met",
  reason: "Turnover is 350 lakh.",
  ...overrides,
});

describe("reportToCsv", () => {
  it("has a header row and one row per condition, with readable labels", () => {
    const lines = reportToCsv([item({}), item({ id: 2, status: "needs_review", category: "required_document" })]).split("\r\n");

    expect(lines[0]).toBe('"Result","Category","Condition","Page","Clause","Reason"');
    expect(lines[1]).toBe('"Met","Turnover","Turnover of at least 300 lakh","5","4.3(a)","Turnover is 350 lakh."');
    expect(lines[2]).toMatch(/^"Needs review","Required document",/);
    expect(lines).toHaveLength(3);
  });

  it("keeps commas, quotes and line breaks inside one cell", () => {
    const csv = reportToCsv([item({ text: 'Must say "yes", then\nsign', page: null, clause: null })]);

    expect(csv.split("\r\n")[1]).toBe('"Met","Turnover","Must say ""yes"", then\nsign","","","Turnover is 350 lakh."');
  });
});

describe("csvFileName", () => {
  it("makes a safe file name from the tender title", () => {
    expect(csvFileName("Road works, Package 3!")).toBe("eligibility-report-road-works-package-3.csv");
    expect(csvFileName("")).toBe("eligibility-report.csv");
  });
});
