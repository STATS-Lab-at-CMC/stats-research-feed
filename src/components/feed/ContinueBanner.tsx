import { ArrowRight, History, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContinueState } from "@/lib/feed/continueTarget";

interface ContinueBannerProps {
  /** Only "target" or "caught-up" — the parent doesn't render this component at all for "hidden". */
  state: Extract<ContinueState, { kind: "target" | "caught-up" }>;
  onContinue: () => void;
}

export function ContinueBanner({ state, onContinue }: ContinueBannerProps) {
  if (state.kind === "caught-up") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm text-foreground">
          <span className="font-medium">You&apos;re all caught up.</span>{" "}
          <span className="text-muted-foreground">Every article in your feed is marked seen.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start gap-3">
        <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium text-foreground">Continue where you left off</p>
          <p className="mt-0.5 text-muted-foreground">
            First unseen article · <span className="italic">{state.article.title}</span>
          </p>
        </div>
      </div>
      <Button size="sm" onClick={onContinue} className="shrink-0">
        Continue
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
