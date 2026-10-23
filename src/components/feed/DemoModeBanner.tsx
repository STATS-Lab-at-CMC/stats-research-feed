import { AlertTriangle } from "lucide-react";

interface DemoModeBannerProps {
  unresolvedJournalCount: number;
}

export function DemoModeBanner({ unresolvedJournalCount }: DemoModeBannerProps) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p>
        <span className="font-semibold">Demo data:</span> OpenAlex could not be reached right now,
        so this feed is showing a small set of clearly-labeled placeholder articles instead of live
        research. Reload once your connection to OpenAlex is available to see real results.
        {unresolvedJournalCount > 0 && (
          <> ({unresolvedJournalCount} followed journal{unresolvedJournalCount === 1 ? "" : "s"} could not be resolved.)</>
        )}
      </p>
    </div>
  );
}
