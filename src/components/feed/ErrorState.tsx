import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  onRetry: () => void;
}

export function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-destructive/40 px-6 py-16 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">Something went wrong loading the feed</p>
        <p className="max-w-md text-sm text-muted-foreground">
          This is unexpected — the app usually falls back to demo data automatically. Try again, or
          reload the page.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
        Try again
      </Button>
    </div>
  );
}
