import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-w-0 rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2 p-6 pb-4", className)} {...props} />;
}

function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-medium leading-tight tracking-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-relaxed text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-3 p-6 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
