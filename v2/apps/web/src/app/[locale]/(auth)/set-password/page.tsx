import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SetPasswordForm } from './set-password-form';

export default async function SetPasswordPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const t = await getTranslations('auth.setPassword');
  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-heading-lg">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <SetPasswordForm />
      </CardContent>
    </Card>
  );
}
