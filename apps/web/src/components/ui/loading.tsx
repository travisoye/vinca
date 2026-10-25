import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-lg bg-muted motion-reduce:animate-none", className)} aria-hidden="true" {...props} />;
}

/** Indeterminate spinner; surfaces keep their space while loading. */
function Spinner({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return <LoaderCircle className={cn("size-4 animate-spin text-muted-foreground motion-reduce:animate-none", className)} aria-hidden {...props} />;
}

/** Panel-level loading treatment with an accessible busy announcement. */
function Loading({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground", className)}
    >
      <Spinner className="size-4" />
      <span>{label}</span>
    </div>
  );
}

export { Skeleton, Spinner, Loading };
