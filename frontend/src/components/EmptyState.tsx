// EmptyState: what a list shows when it has nothing in it yet. Instead of
// a blank space, it says why it is empty and what to do next.
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
};

export default function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-subtle text-fg-4">
        {icon}
      </span>
      <h3 className="mt-4 font-semibold text-fg">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-fg-4">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
