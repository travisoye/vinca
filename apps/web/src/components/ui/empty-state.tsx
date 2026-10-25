import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Compact variant fits inside table/panel regions. */
  size?: "default" | "compact";
}

function EmptyState({ icon: Icon, title, description, action, children, size = "default", className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-border text-center",
        size === "default" ? "gap-4 px-6 py-12" : "gap-2 px-4 py-8",
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className={cn("text-muted-foreground", size === "default" ? "size-6" : "size-4")} aria-hidden /> : null}
      <p className={cn("font-medium leading-relaxed", size === "default" ? "text-base" : "text-sm")}>{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action || children ? <div className="pt-2">{action ?? children}</div> : null}
    </div>
  );
}

export { EmptyState };
