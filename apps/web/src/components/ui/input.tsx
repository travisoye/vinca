import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-11 w-full min-w-0 rounded-lg border border-input bg-background px-4 py-2 text-base transition-colors placeholder:text-muted-foreground aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:text-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full min-w-0 resize-y rounded-lg border border-input bg-background px-4 py-3 text-base leading-relaxed transition-colors placeholder:text-muted-foreground aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none md:text-sm",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Input, Textarea };
