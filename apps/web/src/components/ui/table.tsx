import { cn } from "@/lib/utils";
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/** Table primitives tuned for dense, legible receipt tables (no clutter treatment). */
function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div
      role="region"
      aria-label={props["aria-label"] ? `${props["aria-label"]} scroll area` : "Scrollable data table"}
      tabIndex={0}
      className="relative w-full min-w-0 max-w-full overflow-x-auto rounded-lg"
    >
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-border transition-colors hover:bg-muted/50 focus-within:bg-muted/50 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-12 px-4 text-left align-middle text-xs font-medium tracking-wide text-muted-foreground whitespace-nowrap",
        className,
      )}
      scope="col"
      {...props}
    />
  );
}

function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle leading-relaxed", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
