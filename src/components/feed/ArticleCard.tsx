"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, Check, CheckCircle2, ChevronDown, ChevronUp, Circle, ExternalLink, FileText, Quote } from "lucide-react";
import type { Article } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatApaCitation } from "@/lib/citation/apa";
import { HighlightedText } from "./HighlightedText";
import { formatPublicationDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

interface ArticleCardProps {
  /** Compiled keyword regex, or null when highlighting is off. */
  highlightPattern?: RegExp | null;
  article: Article;
  isSeen: boolean;
  isNew: boolean;
  isBookmarked: boolean;
  onToggleSeen: () => void;
  onToggleBookmark: () => void;
  isContinueTarget?: boolean;
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "Authors not available";
  if (authors.length <= 6) return authors.join(", ");
  return `${authors.slice(0, 6).join(", ")}, et al.`;
}

/**
 * Copies an APA 7th-edition reference for one article.
 *
 * Writes the clipboard in two flavours at once: HTML carrying the italics APA
 * requires on the journal name and volume, and plain text for anywhere that
 * cannot take them. Pasting into Word or Google Docs therefore arrives already
 * formatted, while a plain-text field still gets something sensible.
 * `ClipboardItem` is not universally available, so a plain-text write is kept
 * as a fallback rather than letting the copy fail outright.
 */
function CiteButton({ article }: { article: Article }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const citation = formatApaCitation(article);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([citation.html], { type: "text/html" }),
            "text/plain": new Blob([citation.text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(citation.text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied or unavailable; leave the label unchanged
      // rather than claiming a copy that did not happen.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-1 rounded-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title="Copy an APA 7 reference for this article"
      aria-label={`Copy APA citation for ${article.title}`}
    >
      {copied ? (
        <>
          Copied <Check className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
        </>
      ) : (
        <>
          Cite <Quote className="h-3.5 w-3.5" aria-hidden="true" />
        </>
      )}
    </button>
  );
}

export function ArticleCard({
  article,
  isSeen,
  isNew,
  isBookmarked,
  onToggleSeen,
  onToggleBookmark,
  isContinueTarget = false,
  highlightPattern,
}: ArticleCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      id={`article-${article.id}`}
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-colors",
        "border-l-2",
        isSeen ? "border-l-transparent" : "border-l-primary",
        isContinueTarget && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <Badge variant="outline" className="text-foreground/80">
          {article.journalName}
        </Badge>
        {article.isOpenAccess === true && (
          <Badge variant="secondary" className="bg-secondary/10 text-secondary border-secondary/20">
            Open Access
          </Badge>
        )}
        {isNew && (
          <Badge variant="accent" className="bg-accent/10 text-accent border-accent/20">
            New
          </Badge>
        )}
        {article.source === "demo" && (
          <Badge variant="muted" className="text-muted-foreground">
            Demo data
          </Badge>
        )}
        <span className="text-muted-foreground">{formatPublicationDate(article.publicationDate)}</span>
      </div>

      <h3 className={cn("mt-2 text-base leading-snug", isSeen ? "font-medium text-foreground/90" : "font-semibold text-foreground")}>
        {article.articleUrl ? (
          <a
            href={article.articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <HighlightedText text={article.title} pattern={highlightPattern ?? null} />
          </a>
        ) : (
          <HighlightedText text={article.title} pattern={highlightPattern ?? null} />
        )}
      </h3>

      <p className="mt-1 text-sm text-muted-foreground">{formatAuthors(article.authors)}</p>

      <div className="mt-2">
        {article.abstract ? (
          <>
            <p className={cn("text-sm text-foreground/80", !expanded && "line-clamp-2")}>
              <HighlightedText text={article.abstract} pattern={highlightPattern ?? null} />
            </p>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  Hide abstract <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Show abstract <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </>
        ) : (
          <p className="text-sm italic text-muted-foreground">No abstract available.</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSeen}
            aria-pressed={isSeen}
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {isSeen ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Seen
              </>
            ) : (
              <>
                <Circle className="h-3.5 w-3.5" /> Mark as seen
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleBookmark}
            aria-pressed={isBookmarked}
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {isBookmarked ? (
              <>
                <BookmarkCheck className="h-3.5 w-3.5 text-primary" /> Bookmarked
              </>
            ) : (
              <>
                <Bookmark className="h-3.5 w-3.5" /> Bookmark
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {article.doi && <span className="hidden sm:inline">doi.org/{article.doi}</span>}
          {article.articleUrl ? (
            <a
              href={article.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Open article <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span>Link unavailable</span>
          )}
          {/*
            Only shown when OpenAlex gives a direct PDF address for a freely
            readable copy — roughly a quarter of articles in practice. A link
            that lands on a paywall would be worse than no link, so this never
            falls back to a landing page.
          */}
          <CiteButton article={article} />
          {article.pdfUrl && (
            <a
              href={article.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              title="Free full-text PDF"
            >
              PDF <FileText className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
