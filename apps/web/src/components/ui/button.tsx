import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@/components/ui/slot-slot";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The copper accent is shared with the hero photograph.
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        dark: "bg-foreground text-background hover:bg-foreground/90 shadow-sm",
        outline: "border border-input bg-transparent text-foreground hover:bg-muted/60",
        ghost: "text-foreground hover:bg-muted",
        subtle: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        destructive:
          "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
        // Hero pill style: for dark photographic surfaces.
        hero: "border border-white/60 bg-transparent text-white hover:bg-white/10",
      },
      size: {
        sm: "h-10 min-w-10 px-4 text-sm",
        default: "h-11 min-w-11 px-6 md:text-[15px]",
        lg: "h-12 min-w-12 px-7 md:text-[15px]",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={type ?? (asChild ? undefined : "button")}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
