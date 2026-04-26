'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { Badge } from '@/components/ui/badge';
import { updateEmailTemplateAction } from '@/app/actions/admin';

interface Initial {
  subject: string;
  body: string;
  description: string | null;
  isActive: boolean;
}

export function TemplateEditor(props: {
  templateId: string;
  initial: Initial;
  placeholders: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState(props.initial.subject);
  const [body, setBody] = useState(props.initial.body);
  const [description, setDescription] = useState(props.initial.description ?? '');
  const [isActive, setIsActive] = useState(props.initial.isActive);

  function save() {
    startTransition(async () => {
      const result = await updateEmailTemplateAction({
        templateId: props.templateId,
        subject,
        body,
        description,
        isActive,
      });
      if (result.ok) {
        toast.success('Template updated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {props.placeholders.length > 0 ? (
        <div>
          <div className="mb-1 text-xs uppercase text-muted-foreground">Placeholders</div>
          <div className="flex flex-wrap gap-1">
            {props.placeholders.map((p) => (
              <Badge key={p} variant="outline" className="font-mono text-xs">{`{{${p}}}`}</Badge>
            ))}
          </div>
        </div>
      ) : null}

      <FormField label="Subject" id="subject" required>
        <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </FormField>

      <FormField label="Body" id="body" required>
        <Textarea
          id="body"
          rows={14}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="font-mono text-xs"
        />
      </FormField>

      <FormField label="Description" id="description" hint="Internal note shown to admins">
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Active (sent for matching events)
      </label>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
