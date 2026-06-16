import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-stone-950 text-white hover:bg-stone-800",
        secondary: "bg-amber-100 text-stone-900 hover:bg-amber-200",
        outline: "border border-stone-200 bg-white text-stone-900 hover:bg-stone-50",
        ghost: "text-stone-700 hover:bg-stone-100",
        destructive: "bg-rose-600 text-white hover:bg-rose-700",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export function buttonClassName(props?: VariantProps<typeof buttonVariants> & { className?: string }) {
  const { className, ...variants } = props ?? {};
  return cn(buttonVariants(variants), className);
}
