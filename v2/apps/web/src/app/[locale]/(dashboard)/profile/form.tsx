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
}

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<ProfileInitial>(initial);

  function set<K extends keyof ProfileInitial>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
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

      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
