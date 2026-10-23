"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink, Bookmark, BookmarkCheck } from "lucide-react";
import type { Article } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPublicationDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

interface ArticleCardProps {
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

export function ArticleCard({
  article,
  isSeen,
  isNew,
  isBookmarked,
  onToggleSeen,
  onToggleBookmark,
  isContinueTarget = false,
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
            {article.title}
          </a>
        ) : (
          article.title
        )}
      </h3>

      <p className="mt-1 text-sm text-muted-foreground">{formatAuthors(article.authors)}</p>

      <div className="mt-2">
        {article.abstract ? (
          <>
            <p className={cn("text-sm text-foreground/80", !expanded && "line-clamp-2")}>
              {article.abstract}
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
        </div>
      </div>
    </article>
  );
}
