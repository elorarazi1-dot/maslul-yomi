import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink placeholder:text-muted",
        className,
      )}
      {...props}
    />
  );
}
