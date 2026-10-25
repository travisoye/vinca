import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

/**
 * Shared wrapper for landing sections. Sections deliberately vary in
 * composition (prd.md phase 2) instead of repeating a generic feature grid.
 */
export interface LandingSectionProps extends HTMLAttributes<HTMLElement> {
  id: string;
  eyebrow?: string;
  title: string;
  lead?: string;
  /** Alternating surface treatment. */
  tone?: "plain" | "muted";
  children: ReactNode;
}

function LandingSection({
  id,
  eyebrow,
  title,
  lead,
  tone = "plain",
  className,
  children,
  ...props
}: LandingSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn(
        "scroll-mt-24 border-t border-border",
        tone === "muted" && "bg-muted/40",
        className,
      )}
      {...props}
    >
      <div className="site-container section-space grid gap-6">
        {eyebrow ? (
          <p className="eyebrow">
            {eyebrow}
          </p>
        ) : null}
        <h2 id={`${id}-heading`} className="section-title max-w-2xl">
          {title}
        </h2>
        {lead ? <p className="body-copy max-w-2xl">{lead}</p> : null}
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export { LandingSection };
