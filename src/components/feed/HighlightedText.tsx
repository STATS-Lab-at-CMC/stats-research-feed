import { Fragment } from "react";
import { segmentByKeywords } from "@/lib/keywords/match";

interface HighlightedTextProps {
  text: string;
  /** Null when highlighting is off or no keywords are set — renders plain. */
  pattern: RegExp | null;
}

/**
 * Renders text with keyword matches marked.
 *
 * Uses `<mark>`, which carries the meaning natively and is announced by screen
 * readers, rather than a styled span. The colour is the lab's accent at low
 * opacity rather than the usual yellow, so a page with many hits still reads
 * as this app and not as a highlighter accident.
 */
export function HighlightedText({ text, pattern }: HighlightedTextProps) {
  if (!pattern) return <>{text}</>;

  const segments = segmentByKeywords(text, pattern);
  if (!segments.some((segment) => segment.match)) return <>{text}</>;

  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark
            key={index}
            className="rounded-[0.2rem] bg-accent/25 px-0.5 text-inherit dark:bg-accent/35"
          >
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}
