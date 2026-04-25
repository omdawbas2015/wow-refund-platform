'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { setPasswordAction } from '@/app/actions/auth';

export function SetPasswordForm() {
  const t = useTranslations('auth.setPassword');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await setPasswordAction(fd);
      if (result.ok) {
        toast.success(t('success'));
        router.push('/');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label={t('passwordLabel')} id="password" required hint="At least 8 characters, with letters and numbers">
        <Input id="password" name="password" type="password" autoComplete="new-password" required disabled={pending} />
      </FormField>

      <FormField label={t('confirmPasswordLabel')} id="confirmPassword" required>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required disabled={pending} />
      </FormField>

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? '…' : t('submit')}
      </Button>
    </form>
  );
}
