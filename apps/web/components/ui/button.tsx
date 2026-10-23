import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
const variants = cva("button", {
  variants: {
    variant: {
      default: "button-default",
      outline: "button-outline",
      ghost: "button-ghost",
      primary: "button-primary",
    },
    size: { default: "", icon: "button-icon", sm: "button-sm" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof variants>) {
  return (
    <button
      className={twMerge(clsx(variants({ variant, size, className })))}
      {...props}
    />
  );
}
