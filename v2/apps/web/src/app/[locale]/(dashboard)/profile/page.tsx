import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProfileForm } from './form';
import {
  MUTABLE_NOTIFICATION_KINDS,
  parseMutedKinds,
} from '@/lib/notifications/dispatch';

/**
 * Self-service profile page. Lets the signed-in user update display fields
 * and language / theme / currency preferences. Email + role + country
 * assignments are admin-only and not surfaced here.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      nameAr: true,
      phone: true,
      preferredLocale: true,
      preferredCurrency: true,
      preferredTheme: true,
      mutedNotificationKinds: true,
      role: { select: { key: true, name: true } },
      primaryCountryId: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!me) redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your display name, contact info, and language / theme preferences.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Personal info</CardTitle>
            <CardDescription>
              These fields appear in case histories, mentions, and the topbar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              initial={{
                name: me.name,
                nameAr: me.nameAr ?? '',
                phone: me.phone ?? '',
                preferredLocale: me.preferredLocale,
                preferredCurrency: me.preferredCurrency ?? '',
                preferredTheme: me.preferredTheme,
                mutedKinds: Array.from(parseMutedKinds(me.mutedNotificationKinds)),
              }}
              mutableKinds={MUTABLE_NOTIFICATION_KINDS}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Read-only — managed by an admin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field label="Email" value={me.email} />
            <Field label="Role" value={me.role?.name ?? '—'} />
            <Field
              label="Last login"
              value={me.lastLoginAt ? me.lastLoginAt.toLocaleString() : '—'}
            />
            <Field
              label="Member since"
              value={me.createdAt.toLocaleDateString()}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-foreground">{value}</div>
    </div>
  );
}
