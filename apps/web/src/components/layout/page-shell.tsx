import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/**
 * Standard route-shell header for phases 2 and 3 to build upon. Keeps route
 * titles consistent and marks unfinished areas as phase pending.
 */
export interface PageShellProps extends HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
  /** One-day ownership ratio of the page (route number per prd phase). */
  phase?: number;
}

function PageShell({ title, description, className, ...props }: PageShellProps) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4", className)} {...props}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">{title}</h1>
      </div>
      {description ? <p className="body-copy max-w-2xl">{description}</p> : null}
    </section>
  );
}

export { PageShell };
