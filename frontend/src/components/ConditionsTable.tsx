// ConditionsTable: the conditions found in one tender, with where each
// one is in the document (FR-10, FR-11).
import type { Condition } from "../api";

export default function ConditionsTable({ conditions }: { conditions: Condition[] }) {
  if (conditions.length === 0) {
    return (
      <p className="text-slate-600">
        No conditions yet. Click "Analyze" on the tender to extract them.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Condition</th>
            <th className="px-3 py-2 font-medium">Page</th>
            <th className="px-3 py-2 font-medium">Clause</th>
          </tr>
        </thead>
        <tbody>
          {conditions.map((condition) => (
            <tr key={condition.id} className="border-t border-slate-200 align-top">
              <td className="px-3 py-2 capitalize">{condition.category}</td>
              {/* min-w keeps the text readable when the table scrolls on a phone. */}
              <td className="min-w-64 px-3 py-2">{condition.text}</td>
              <td className="px-3 py-2 tabular-nums">{condition.page ?? "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">{condition.clause ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
