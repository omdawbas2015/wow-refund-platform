import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignupForm } from './signup-form';

export default async function SignupPage() {
  const t = await getTranslations('auth.signup');
  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-heading-lg">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
        <div className="mt-6 text-center text-sm text-muted-foreground">
          {t('hasAccount')}{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('loginLink')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
