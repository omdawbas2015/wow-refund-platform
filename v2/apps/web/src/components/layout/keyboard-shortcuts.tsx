'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Shortcut {
  /** Key sequence as displayed; first letter is matched after `g`. */
  keys: string;
  /** Single character to match after the leader `g`. Lowercase. */
  letter?: string;
  /** Solo key without leader, e.g. '/' or '?'. Lowercase. */
  solo?: string;
  label: string;
  href?: string;
  action?: 'focus-search' | 'show-help';
}

const SHORTCUTS: Shortcut[] = [
  { keys: 'g d', letter: 'd', label: 'Go to Dashboard', href: '/' },
  { keys: 'g c', letter: 'c', label: 'Go to Cases', href: '/cases' },
  { keys: 'g o', letter: 'o', label: 'Go to Refund Operations', href: '/operations' },
  { keys: 'g p', letter: 'p', label: 'Go to Promo Codes', href: '/promo' },
  { keys: 'g s', letter: 's', label: 'Go to Stores Communication', href: '/help-desk/stores' },
  { keys: 'g r', letter: 'r', label: 'Go to Reports', href: '/reports' },
  { keys: 'g a', letter: 'a', label: 'Go to Admin', href: '/admin' },
  { keys: 'g n', letter: 'n', label: 'New refund case', href: '/cases/new' },
  { keys: '/', solo: '/', label: 'Focus global search', action: 'focus-search' },
  { keys: '?', solo: '?', label: 'Show this help', action: 'show-help' },
];

/**
 * Mounts global keyboard shortcuts on the dashboard. Listeners no-op when
 * focus is inside an editable element (input, textarea, contentEditable) or
 * when a modifier key (Ctrl/Cmd/Alt/Meta) is pressed, so we don't fight with
 * native shortcuts or interrupt typing.
 *
 * The Vim-style "g <letter>" leader pattern keeps top-level keys free for
 * other UI (e.g. `t` for tabs in the future) — press `g` then a letter
 * within 1.5s.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let leaderActive = false;
    let leaderTimer: ReturnType<typeof setTimeout> | null = null;

    function clearLeader() {
      leaderActive = false;
      if (leaderTimer) {
        clearTimeout(leaderTimer);
        leaderTimer = null;
      }
    }

    function isEditable(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return false;
    }

    function fire(s: Shortcut) {
      if (s.href) {
        router.push(s.href);
      } else if (s.action === 'focus-search') {
        const input = document.querySelector<HTMLInputElement>('input[type="search"]');
        input?.focus();
      } else if (s.action === 'show-help') {
        setHelpOpen(true);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditable(e.target)) {
        // Allow Escape to blur the input so subsequent shortcuts work.
        if (e.key === 'Escape' && e.target instanceof HTMLElement) {
          e.target.blur();
        }
        return;
      }

      const key = e.key.toLowerCase();

      if (helpOpen && e.key === 'Escape') {
        setHelpOpen(false);
        return;
      }

      if (leaderActive) {
        const match = SHORTCUTS.find((s) => s.letter === key);
        clearLeader();
        if (match) {
          e.preventDefault();
          fire(match);
        }
        return;
      }

      if (key === 'g') {
        leaderActive = true;
        leaderTimer = setTimeout(clearLeader, 1500);
        return;
      }

      // Solo keys (use raw e.key so '?' is detected as Shift+/).
      const solo = SHORTCUTS.find((s) => s.solo === e.key || s.solo === key);
      if (solo) {
        e.preventDefault();
        fire(solo);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearLeader();
    };
  }, [router, helpOpen]);

  if (!helpOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-help-title"
      onClick={() => setHelpOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 id="shortcuts-help-title" className="text-base font-medium text-heading">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setHelpOpen(false)}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-surface-subtle"
          >
            ✕
          </button>
        </div>
        <ul className="mt-4 divide-y divide-border">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <kbd className="rounded-md border border-border bg-surface-subtle px-2 py-0.5 font-mono text-xs text-heading">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Press <kbd className="rounded-sm border border-border bg-surface-subtle px-1 font-mono">Esc</kbd> to close.
        </p>
      </div>
    </div>
  );
}
