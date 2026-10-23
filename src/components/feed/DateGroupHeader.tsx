interface DateGroupHeaderProps {
  label: string;
  count: number;
}

export function DateGroupHeader({ label, count }: DateGroupHeaderProps) {
  return (
    <div className="flex items-baseline gap-2 pb-1 pt-2 first:pt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}
