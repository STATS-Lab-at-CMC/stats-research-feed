function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
      <div className="mt-1.5 h-3 w-5/6 animate-pulse rounded bg-muted" />
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading your research feed">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
      <span className="sr-only">Loading your research feed…</span>
    </div>
  );
}
