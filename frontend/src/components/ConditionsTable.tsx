// ConditionsTable: the conditions found in one tender, with where each
// one is in the document (FR-10, FR-11).
import { FileSearch } from "lucide-react";

import type { Condition } from "../api";
import { formatCategory } from "../format";
import EmptyState from "./EmptyState";

export default function ConditionsTable({ conditions }: { conditions: Condition[] }) {
  if (conditions.length === 0) {
    return (
      <EmptyState icon={<FileSearch aria-hidden="true" className="size-6" />} title="No conditions yet">
        Click "Analyze" on the tender to extract its conditions.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-surface-muted text-xs tracking-wide text-fg-4 uppercase">
          <tr>
            <th className="px-5 py-3 font-medium">Category</th>
            <th className="px-5 py-3 font-medium">Condition</th>
            <th className="px-5 py-3 font-medium">Page</th>
            <th className="px-5 py-3 font-medium">Clause</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {conditions.map((condition) => (
            <tr key={condition.id} className="align-top hover:bg-surface-muted/60">
              <td className="px-5 py-3">
                <span className="inline-flex rounded-md bg-surface-subtle px-2 py-0.5 text-xs font-medium whitespace-nowrap text-fg-2">
                  {formatCategory(condition.category)}
                </span>
              </td>
              {/* min-w keeps the text readable when the table scrolls on a phone. */}
              <td className="min-w-72 px-5 py-3 text-fg">{condition.text}</td>
              <td className="px-5 py-3 text-fg-3 tabular-nums">{condition.page ?? "—"}</td>
              <td className="px-5 py-3 whitespace-nowrap text-fg-3">{condition.clause ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
