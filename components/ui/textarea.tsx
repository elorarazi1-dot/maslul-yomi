import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-36 w-full rounded-xl border border-line bg-paper px-3 py-3 text-base text-ink placeholder:text-muted",
        className,
      )}
      {...props}
    />
  );
}
