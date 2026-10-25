import { cloneElement, Fragment, isValidElement, useId, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/**
 * Field groups a labelled control with optional help text and an error
 * message, so dialogs and forms expose accessible descriptions consistently.
 */
export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor?: string;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
}

function Field({ label, htmlFor, help, error, className, children, ...props }: FieldProps) {
  const generatedId = useFieldId();
  const control = isValidElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: HTMLAttributes<HTMLElement>["aria-invalid"];
  }>(children) && children.type !== Fragment ? children : null;
  const controlId = control?.props.id ?? htmlFor ?? generatedId;
  const helpId = help && !error ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [control?.props["aria-describedby"], helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)} {...props}>
      <Label htmlFor={controlId}>{label}</Label>
      {control ? cloneElement(control, {
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : control.props["aria-invalid"],
      }) : children}
      {helpId ? <p id={helpId} className="text-sm leading-relaxed text-muted-foreground">{help}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm leading-relaxed text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Convenience hook: returns an id to wire an input and its Field together. */
function useFieldId(): string {
  const id = useId();
  return `field-${id}`;
}

export { Field, useFieldId };
