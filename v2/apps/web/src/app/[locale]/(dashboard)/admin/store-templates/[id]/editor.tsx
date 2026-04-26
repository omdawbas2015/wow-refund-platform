'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { upsertStoreMessageTemplateAction } from '@/app/actions/help-desk';

interface Template {
  id: string;
  key: string;
  label: string;
  labelAr: string | null;
  subject: string;
  body: string;
  isActive: boolean;
  sortOrder: number;
}

export function TemplateEditor({ template }: { template: Template | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [key, setKey] = useState(template?.key ?? '');
  const [label, setLabel] = useState(template?.label ?? '');
  const [labelAr, setLabelAr] = useState(template?.labelAr ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(template?.sortOrder ?? 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await upsertStoreMessageTemplateAction({
        ...(template?.id ? { templateId: template.id } : {}),
        key,
        label,
        labelAr,
        subject,
        body,
        isActive,
        sortOrder,
      });
      if (result.ok) {
        toast.success('Saved');
        if (!template) router.push(`/admin/store-templates/${result.data.id}`);
        else router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Field label="Key">
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-sm"
            required
          />
        </Field>
        <Field label="Label (en)">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            required
          />
        </Field>
        <Field label="Label (ar)">
          <input
            type="text"
            value={labelAr}
            onChange={(e) => setLabelAr(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </Field>
      </div>

      <Field label="Subject">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          required
        />
      </Field>

      <Field label="Body">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Sort order">
          <input
            type="number"
            min="0"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </Field>
        <label className="flex items-end gap-2 pb-1 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          Active
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : template ? 'Save changes' : 'Create template'}
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
