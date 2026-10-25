/*
  Minimal Slot helper (a take on the pattern Radix exposes through
  @radix-ui/react-slot) so `asChild` works without adding another
  dependency beyond what package.json already declares.
*/
import { Children, cloneElement, isValidElement, type ReactElement } from "react";
import type { HTMLAttributes } from "react";

export function Slot({
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const child = Children.only(children);
  if (!isValidElement(child)) {
    return null;
  }
  const childProps = child.props as HTMLAttributes<HTMLElement>;
  return cloneElement(child as ReactElement<HTMLAttributes<HTMLElement>>, {
    ...props,
    ...childProps,
    className: [props.className, childProps.className].filter(Boolean).join(" "),
  });
}
