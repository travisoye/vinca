import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Eye, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const alertVariants = cva(
  "relative grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-xl border p-4 text-sm leading-relaxed [&_svg]:size-4",
  {
    variants: {
      variant: {
        info: "border-border bg-card text-card-foreground",
        warning: "border-destructive/30 bg-destructive/10 text-card-foreground",
        destructive: "border-destructive/40 bg-destructive/15 text-card-foreground",
        success: "border-primary/30 bg-primary/10 text-card-foreground",
        // Persistent preview notice styling (used app-wide during the fixture phase).
        preview: "border-dashed border-border bg-muted/60 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const alertIconColorByVariant: Record<string, string> = {
  info: "var(--muted-foreground)",
  warning: "var(--destructive)",
  destructive: "var(--destructive)",
  success: "var(--primary)",
  preview: "var(--muted-foreground)",
};

const alertIconByVariant: Record<string, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  destructive: AlertTriangle,
  success: CheckCircle2,
  preview: Eye,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** Optionally override the default icon for the variant. */
  icon?: LucideIcon;
  title?: string;
}

function Alert({ className, variant = "info", icon, title, children, ...props }: AlertProps) {
  const Icon = icon ?? alertIconByVariant[variant ?? "info"] ?? Info;
  const iconColor = alertIconColorByVariant[variant ?? "info"];
  return (
    <div role={variant === "warning" || variant === "destructive" ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5" style={{ color: iconColor }} aria-hidden />
      <div className="flex min-w-0 flex-col gap-1.5">
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        {children}
      </div>
    </div>
  );
}

function AlertTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5 className={cn("font-medium leading-tight tracking-tight", className)} {...props}>
      {children}
    </h5>
  );
}

function AlertDescription({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-xs leading-relaxed text-muted-foreground", className)} {...props}>
      {children}
    </div>
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
