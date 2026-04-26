'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfileAction } from '@/app/actions/profile';

export interface ProfileInitial {
  name: string;
  nameAr: string;
  phone: string;
  preferredLocale: string;
  preferredCurrency: string;
  preferredTheme: string;
  mutedKinds: string[];
}

interface MutableKind {
  kind: string;
  label: string;
  description: string;
}

export function ProfileForm({
  initial,
  mutableKinds,
}: {
  initial: ProfileInitial;
  mutableKinds: MutableKind[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<ProfileInitial>(initial);
  const [muted, setMuted] = useState<Set<string>>(new Set(initial.mutedKinds));

  function set<K extends keyof ProfileInitial>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function toggleMute(kind: string) {
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set('name', values.name);
    fd.set('nameAr', values.nameAr);
    fd.set('phone', values.phone);
    fd.set('preferredLocale', values.preferredLocale);
    fd.set('preferredCurrency', values.preferredCurrency);
    fd.set('preferredTheme', values.preferredTheme);
    // Send a `mute:<KIND>=on` entry per muted kind. Unchecked kinds are
    // simply absent — the server treats absence as 'not muted'.
    for (const kind of muted) fd.set(`mute:${kind}`, 'on');

    startTransition(async () => {
      const result = await updateProfileAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Profile saved');
      // Refresh the server component so the new values render.
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="profile-name">Display name</Label>
        <Input
          id="profile-name"
          required
          maxLength={120}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="profile-nameAr">Display name (Arabic)</Label>
        <Input
          id="profile-nameAr"
          maxLength={120}
          dir="rtl"
          value={values.nameAr}
          onChange={(e) => set('nameAr', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="profile-phone">Phone</Label>
        <Input
          id="profile-phone"
          type="tel"
          maxLength={32}
          value={values.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="profile-locale">Language</Label>
        <select
          id="profile-locale"
          value={values.preferredLocale}
          onChange={(e) => set('preferredLocale', e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
        >
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </div>

      <div>
        <Label htmlFor="profile-currency">Display currency</Label>
        <Input
          id="profile-currency"
          placeholder="KWD"
          maxLength={6}
          value={values.preferredCurrency}
          onChange={(e) => set('preferredCurrency', e.target.value.toUpperCase())}
        />
        <p className="mt-1 text-xs text-muted-foreground">ISO 4217 code, optional.</p>
      </div>

      <div>
        <Label htmlFor="profile-theme">Theme</Label>
        <select
          id="profile-theme"
          value={values.preferredTheme}
          onChange={(e) => set('preferredTheme', e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>

      <div className="sm:col-span-2 mt-2 border-t border-border/60 pt-4">
        <h3 className="text-sm font-medium">Mute notifications</h3>
        <p className="text-xs text-muted-foreground">
          Skip these kinds in your inbox. Audit and email logs are unaffected.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {mutableKinds.map((m) => {
            const checked = muted.has(m.kind);
            const id = `mute-${m.kind}`;
            return (
              <label
                key={m.kind}
                htmlFor={id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border/60 bg-surface/40 p-3 text-sm hover:border-border"
              >
                <input
                  id={id}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={checked}
                  onChange={() => toggleMute(m.kind)}
                />
                <div className="flex-1">
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
