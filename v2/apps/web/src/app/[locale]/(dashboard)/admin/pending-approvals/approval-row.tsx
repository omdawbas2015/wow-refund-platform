'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle } from 'lucide-react';
import { approveUserAction, rejectUserAction } from '@/app/actions/admin';

interface ApprovalRowProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    createdAtLabel: string;
  };
  roles: Array<{ id: string; label: string }>;
  countries: Array<{ id: string; label: string; flag: string }>;
}

export function ApprovalRow({ user, roles, countries }: ApprovalRowProps) {
  const t = useTranslations('admin.pendingApprovals');
  const [pending, startTransition] = useTransition();
  const [roleId, setRoleId] = useState<string>('');
  const [countryId, setCountryId] = useState<string>('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  function handleApprove() {
    if (!roleId) {
      toast.error('Please assign a role');
      return;
    }
    const fd = new FormData();
    fd.set('userId', user.id);
    fd.set('roleId', roleId);
    if (countryId) fd.set('primaryCountryId', countryId);

    startTransition(async () => {
      const result = await approveUserAction(fd);
      if (result.ok) toast.success(t('approveSuccess'));
      else toast.error(result.error);
    });
  }

  function handleReject() {
    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    const fd = new FormData();
    fd.set('userId', user.id);
    fd.set('reason', reason);

    startTransition(async () => {
      const result = await rejectUserAction(fd);
      if (result.ok) toast.success(t('rejectSuccess'));
      else toast.error(result.error);
    });
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
          {user.phone ? <div className="text-xs text-muted-foreground">{user.phone}</div> : null}
          <div className="mt-1 text-xs text-muted-foreground">{user.createdAtLabel}</div>
        </div>

        {!rejecting ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t('assignRole')} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={countryId} onValueChange={setCountryId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('assignCountry')} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.flag} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button size="sm" onClick={handleApprove} disabled={pending}>
              <CheckCircle2 className="h-4 w-4" />
              {t('approve')}
            </Button>

            <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={pending}>
              <XCircle className="h-4 w-4" />
              {t('reject')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder={t('reason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-64"
              disabled={pending}
            />
            <Button size="sm" variant="destructive" onClick={handleReject} disabled={pending}>
              {t('reject')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRejecting(false);
                setReason('');
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
