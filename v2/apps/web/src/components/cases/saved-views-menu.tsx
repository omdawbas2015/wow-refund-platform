'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bookmark, ChevronDown, Plus, Trash2, Share2 } from 'lucide-react';
import {
  createSavedViewAction,
  deleteSavedViewAction,
  listSavedViewsAction,
} from '@/app/actions/saved-views';

interface SavedView {
  id: string;
  name: string;
  filters: string;
  isShared: boolean;
  mine: boolean;
}

export function SavedViewsMenu({
  scope,
  basePath,
  currentQs,
  isAdmin,
}: {
  scope: 'CASES' | 'PROMOS' | 'BATCHES' | 'STORE_MESSAGES' | 'DASHBOARD';
  basePath: string;
  currentQs: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listSavedViewsAction(scope)
      .then((result) => {
        if (result.ok) setViews(result.data.views);
      })
      .finally(() => setLoading(false));
  }, [open, scope]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function applyView(filters: string) {
    setOpen(false);
    router.push(filters ? `${basePath}?${filters}` : basePath);
  }

  function saveCurrent() {
    const name = window.prompt('Name this view');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const wantsShared =
      isAdmin && window.confirm('Share this view with the whole team? OK = shared, Cancel = private');
    startTransition(async () => {
      const result = await createSavedViewAction({
        scope,
        name: trimmed,
        filters: currentQs,
        isShared: wantsShared,
      });
      if (result.ok) {
        toast.success(`Saved view "${trimmed}".`);
        const refreshed = await listSavedViewsAction(scope);
        if (refreshed.ok) setViews(refreshed.data.views);
      } else {
        toast.error(result.error);
      }
    });
  }

  function destroy(view: SavedView) {
    if (!confirm(`Delete saved view "${view.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteSavedViewAction({ id: view.id });
      if (result.ok) {
        setViews((prev) => prev.filter((v) => v.id !== view.id));
        toast.success('Deleted.');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-surface-subtle"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Saved views
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open ? (
        <div className="absolute end-0 z-30 mt-1 w-72 rounded-md border border-border bg-popover p-1 shadow-md">
          <button
            type="button"
            onClick={saveCurrent}
            disabled={pending}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-subtle disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Save current view…
          </button>
          <div className="my-1 h-px bg-border" />
          {loading ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">Loading…</div>
          ) : views.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              No saved views yet.
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto">
              {views.map((v) => (
                <li
                  key={v.id}
                  className="group flex items-center gap-2 rounded-md px-1 hover:bg-surface-subtle"
                >
                  <button
                    type="button"
                    onClick={() => applyView(v.filters)}
                    className="min-w-0 flex-1 truncate px-2 py-1.5 text-start text-sm"
                    title={v.filters || '(no filters)'}
                  >
                    {v.name}
                    {v.isShared ? (
                      <span className="ms-2 inline-flex items-center gap-0.5 text-[10px] uppercase text-muted-foreground">
                        <Share2 className="h-3 w-3" /> shared
                      </span>
                    ) : null}
                  </button>
                  {v.mine ? (
                    <button
                      type="button"
                      onClick={() => destroy(v)}
                      disabled={pending}
                      className="me-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      aria-label={`Delete ${v.name}`}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
