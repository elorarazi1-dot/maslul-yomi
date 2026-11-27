import { Button } from "@/components/ui/button";

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">
      <p className="font-semibold">{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>
          נסו שוב
        </Button>
      ) : null}
    </div>
  );
}
