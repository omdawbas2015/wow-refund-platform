'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addCaseNoteAction } from '@/app/actions/cases';

interface Teammate {
  id: string;
  name: string;
  email: string;
}

interface NoteItem {
  id: string;
  body: string;
  authorName: string;
  authorEmail: string;
  createdAt: string;
  mentions: string[];
}

export function NotesSection(props: {
  caseId: string;
  teammates: Teammate[];
  notes: NoteItem[];
  localeFmt: string;
}) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const [mentioned, setMentioned] = useState<string[]>([]);

  function toggleMention(id: string) {
    setMentioned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    if (!body.trim()) {
      toast.error('Note cannot be empty');
      return;
    }
    const fd = new FormData();
    fd.set('caseId', props.caseId);
    fd.set('body', body.trim());
    for (const id of mentioned) fd.append('mentionedUserIds', id);

    startTransition(async () => {
      const result = await addCaseNoteAction(fd);
      if (result.ok) {
        toast.success('Note added');
        setBody('');
        setMentioned([]);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note for your team…"
          rows={3}
        />
        {props.teammates.length > 0 ? (
          <details className="rounded-md border border-border bg-surface-subtle p-2 text-xs">
            <summary className="cursor-pointer font-medium text-body">
              Mention teammates {mentioned.length > 0 ? `(${mentioned.length})` : ''}
            </summary>
            <div className="mt-2 flex max-h-40 flex-wrap gap-1 overflow-y-auto">
              {props.teammates.slice(0, 50).map((t) => {
                const active = mentioned.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleMention(t.id)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-surface text-body hover:bg-surface-subtle'
                    }`}
                  >
                    @{t.name}
                  </button>
                );
              })}
            </div>
          </details>
        ) : null}
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
            {pending ? 'Posting…' : 'Add note'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {props.notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          props.notes.map((n) => (
            <div key={n.id} className="rounded-md border border-border bg-surface p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-body">{n.authorName}</span>
                <span>·</span>
                <span>{n.createdAt}</span>
                {n.mentions.length > 0 ? (
                  <span className="text-primary">@{n.mentions.join(', @')}</span>
                ) : null}
              </div>
              <div className="whitespace-pre-wrap text-sm text-body">{n.body}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
