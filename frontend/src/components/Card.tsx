// Card: a white box with a border, used to group each part of a page.
// An optional title, description and actions appear in a header row.
import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  // false for content that sets its own padding, such as a full-width table.
  padded?: boolean;
};

export default function Card({
  title,
  description,
  icon,
  actions,
  children,
  className = "",
  padded = true,
}: CardProps) {
  return (
    <section className={`rounded-xl bg-surface shadow-sm ring-1 ring-line ${className}`}>
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-5 py-4">
          <div className="flex items-start gap-3">
            {icon && (
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                {icon}
              </span>
            )}
            <div>
              <h2 className="text-base font-semibold text-fg">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-fg-4">{description}</p>}
            </div>
          </div>
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}
