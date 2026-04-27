'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { Sparkles, X } from 'lucide-react';
import { LATEST_CHANGELOG } from '@/app/[locale]/(dashboard)/changelog/entries';

const STORAGE_KEY = 'changelog-dismissed-version';

/**
 * Dismissible banner that points users at the latest changelog entry. Stored
 * dismissal is per-version, so a new release re-shows the banner without
 * code changes — the version string in entries.ts is the only switch.
 *
 * Uses localStorage (no server round-trip) and renders nothing during SSR
 * to avoid layout shift before hydration. The banner sits between the
 * top-bar and main content in the dashboard layout.
 */
export function ChangelogBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (dismissed !== LATEST_CHANGELOG.version) {
        setHidden(false);
      }
    } catch {
      // localStorage unavailable (e.g. private mode) — keep the banner shown
      // so the user still gets the cue.
      setHidden(false);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, LATEST_CHANGELOG.version);
    } catch {
      // ignore — visual dismissal still works for the rest of the session.
    }
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <div className="border-b border-primary/20 bg-primary/5">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-2 text-heading">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">
            <span className="me-1.5 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary">
              {LATEST_CHANGELOG.version}
            </span>
            <span className="font-medium">{LATEST_CHANGELOG.title}</span>
            <Link
              href="/changelog"
              className="ms-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              See what's new →
            </Link>
          </span>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss changelog banner"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-heading"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
