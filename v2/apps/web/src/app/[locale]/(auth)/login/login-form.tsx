'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function LoginForm({ callbackUrl, error: initialError }: { callbackUrl: string; error?: string }) {
  const t = useTranslations('auth.login');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(initialError ?? null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');

    startTransition(async () => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const err = result.error;
        if (err.includes('ACCOUNT_PENDING')) setError(t('accountPending'));
        else if (err.includes('ACCOUNT_SUSPENDED')) setError(t('accountSuspended'));
        else if (err.includes('ACCOUNT_LOCKED')) setError(t('accountLocked'));
        else setError(t('invalidCredentials'));
        return;
      }

      toast.success(t('submit'));
      router.push(callbackUrl);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormField label={t('emailLabel')} id="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          disabled={pending}
        />
      </FormField>

      <FormField label={t('passwordLabel')} id="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </FormField>

      <div className="flex items-center justify-between text-sm">
        <div />
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          {t('forgotPassword')}
        </Link>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? '…' : t('submit')}
      </Button>
    </form>
  );
}
