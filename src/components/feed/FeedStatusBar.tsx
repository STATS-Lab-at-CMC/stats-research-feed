interface FeedStatusBarProps {
  totalShown: number;
  unseenCount: number;
  newSinceLastVisit: number | null;
  journalsFollowed: number;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold text-foreground">{value}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

export function FeedStatusBar({
  totalShown,
  unseenCount,
  newSinceLastVisit,
  journalsFollowed,
}: FeedStatusBarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
      aria-label="Feed summary"
    >
      <Stat value={totalShown} label={totalShown === 1 ? "article shown" : "articles shown"} />
      <span className="text-border" aria-hidden="true">
        ·
      </span>
      <Stat value={unseenCount} label="unseen" />
      {newSinceLastVisit !== null && (
        <>
          <span className="text-border" aria-hidden="true">
            ·
          </span>
          <Stat value={newSinceLastVisit} label="new since your last visit" />
        </>
      )}
      <span className="text-border" aria-hidden="true">
        ·
      </span>
      <Stat value={journalsFollowed} label={journalsFollowed === 1 ? "journal followed" : "journals followed"} />
    </div>
  );
}
