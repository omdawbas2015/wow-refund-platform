'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sendStoreMessageAction } from '@/app/actions/help-desk';

interface Template {
  id: string;
  key: string;
  label: string;
  labelAr: string | null;
}

export function SendStoreMessageForm({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [storeEmail, setStoreEmail] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [note, setNote] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await sendStoreMessageAction({
        templateId,
        storeEmail,
        caseNumber,
        note,
      });
      if (result.ok) {
        toast.success('Message sent');
        setStoreEmail('');
        setCaseNumber('');
        setNote('');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Template">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            required
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Case number">
          <input
            type="text"
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value)}
            placeholder="e.g. KW-2026-0001"
            className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-sm"
            required
          />
        </Field>
        <Field label="Store email">
          <input
            type="email"
            value={storeEmail}
            onChange={(e) => setStoreEmail(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            required
          />
        </Field>
      </div>

      <Field label="Note (optional, replaces {{note}} in the template)">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send message'}
        </Button>
      </div>
    </form>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
      {props.label}
      {props.children}
    </label>
  );
}
