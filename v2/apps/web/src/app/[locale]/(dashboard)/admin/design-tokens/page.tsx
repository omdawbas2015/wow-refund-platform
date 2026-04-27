import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { canViewAdminArea } from '@/lib/rbac/roles';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

export const dynamic = 'force-dynamic';

/**
 * Design system reference — a single page that renders every semantic
 * token, font weight, and component swatch the app uses. Living
 * documentation for the three-layer token system introduced in Sprint
 * D #14: --ref-* primitives feed semantic tokens (--background,
 * --primary, etc.) which feed --c-* component tokens.
 *
 * Use this page to verify dark-mode parity, RTL fonts, and contrast
 * regressions in one glance instead of clicking through 50 routes.
 *
 * Deliberately admin-area-only (or AUDITOR) so the preview doesn't
 * leak to public users.
 */

const SEMANTIC_SWATCHES: { token: string; label: string; on?: string }[] = [
  { token: 'background', label: 'background', on: 'foreground' },
  { token: 'surface', label: 'surface', on: 'foreground' },
  { token: 'surface-subtle', label: 'surface-subtle', on: 'foreground' },
  { token: 'card', label: 'card', on: 'card-foreground' },
  { token: 'primary', label: 'primary', on: 'primary-foreground' },
  { token: 'secondary', label: 'secondary', on: 'secondary-foreground' },
  { token: 'muted', label: 'muted', on: 'muted-foreground' },
  { token: 'accent', label: 'accent', on: 'accent-foreground' },
  { token: 'destructive', label: 'destructive', on: 'destructive-foreground' },
  { token: 'success', label: 'success', on: 'success-foreground' },
  { token: 'warning', label: 'warning', on: 'warning-foreground' },
  { token: 'info', label: 'info', on: 'info-foreground' },
  { token: 'border', label: 'border' },
  { token: 'input', label: 'input' },
  { token: 'ring', label: 'ring' },
];

export default async function DesignTokensPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!canViewAdminArea(session.user.role)) redirect('/');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Design tokens</h1>
        <p className="text-muted-foreground">
          Living preview of the three-layer token system. Toggle dark mode in
          settings to verify dark-mode parity at a glance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Semantic palette</CardTitle>
          <CardDescription>
            Layer 2 tokens. Components reference these — never the raw
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
              --ref-*
            </code>
            primitives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {SEMANTIC_SWATCHES.map((s) => (
              <div
                key={s.token}
                className={`rounded-md border border-border p-3 bg-${s.token} ${
                  s.on ? `text-${s.on}` : 'text-foreground'
                }`}
              >
                <div className="text-sm font-medium">{s.label}</div>
                <div className="mt-1 font-mono text-xs opacity-75">
                  bg-{s.token}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Typography</CardTitle>
          <CardDescription>
            Inter (LTR) / IBM Plex Sans Arabic (RTL body) / Cairo (RTL display).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-4xl font-bold">The quick brown fox 0123456789</p>
          <p className="text-3xl font-semibold">The quick brown fox</p>
          <p className="text-2xl font-medium">The quick brown fox</p>
          <p className="text-xl">The quick brown fox</p>
          <p className="text-base">The quick brown fox jumps over the lazy dog.</p>
          <p className="text-sm text-muted-foreground">
            Smaller secondary text — appears throughout admin tables and dialogs.
          </p>
          <p className="font-mono text-sm">
            const status = &apos;PENDING_APPROVAL&apos;;
          </p>
          <p
            dir="rtl"
            className="text-2xl font-semibold"
            style={{ fontFamily: 'var(--font-arabic-display), Cairo' }}
          >
            النص العربي للعناوين — Cairo
          </p>
          <p
            dir="rtl"
            className="text-base"
            style={{ fontFamily: 'var(--font-arabic-text), IBM Plex Sans Arabic' }}
          >
            هذه فقرة باللغة العربية بخط IBM Plex Sans Arabic للنصوص العادية في
            لوحة التحكم. النص هنا يجب أن يقرأ بسهولة على شاشات سطح المكتب
            والهاتف المحمول.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Component swatches</CardTitle>
          <CardDescription>
            Layer 3 component tokens (
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
              --c-*
            </code>
            ) reference Layer 2 semantic tokens. Future themes can re-skin a
            single component without touching the semantic layer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <span className="inline-flex items-center rounded-full bg-success px-3 py-1 text-xs font-medium text-success-foreground">
            success badge
          </span>
          <span className="inline-flex items-center rounded-full bg-warning px-3 py-1 text-xs font-medium text-warning-foreground">
            warning badge
          </span>
          <span className="inline-flex items-center rounded-full bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground">
            destructive badge
          </span>
          <span className="inline-flex items-center rounded-full bg-info px-3 py-1 text-xs font-medium text-info-foreground">
            info badge
          </span>
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            muted badge
          </span>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            primary button
          </button>
          <button className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-subtle">
            secondary button
          </button>
          <button
            disabled
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50"
          >
            disabled
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
