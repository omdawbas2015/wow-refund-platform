'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { suspendUserAction, reactivateUserAction } from '@/app/actions/admin';

interface Props {
  userId: string;
  status: string;
  isSelf: boolean;
}

export function UserRowActions({ userId, status, isSelf }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>;
  }

  if (status === 'ACTIVE') {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!confirm('Suspend this user? They will lose login access until reactivated.')) return;
          startTransition(async () => {
            const fd = new FormData();
            fd.set('userId', userId);
            const res = await suspendUserAction(fd);
            if (!res.ok) alert(res.error);
            else router.refresh();
          });
        }}
      >
        Suspend
      </Button>
    );
  }

  if (status === 'SUSPENDED') {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const fd = new FormData();
            fd.set('userId', userId);
            const res = await reactivateUserAction(fd);
            if (!res.ok) alert(res.error);
            else router.refresh();
          });
        }}
      >
        Reactivate
      </Button>
    );
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}
