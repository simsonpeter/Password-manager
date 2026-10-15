import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink shadow-sm placeholder:text-muted focus-visible:border-teal",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
