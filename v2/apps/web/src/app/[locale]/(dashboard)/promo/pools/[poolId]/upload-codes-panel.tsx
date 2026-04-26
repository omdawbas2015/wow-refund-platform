'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadPromoCodesAction } from '@/app/actions/promo';
import { parsePromoCodesText } from '@wow/validators';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Check, AlertTriangle } from 'lucide-react';

export function UploadCodesPanel({ poolId }: { poolId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = parsePromoCodesText(text);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (parsed.length === 0) {
      setError('Paste at least one code (one per line).');
      return;
    }
    startTransition(async () => {
      const res = await uploadPromoCodesAction({
        poolId,
        codes: parsed,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res.data!);
      setText('');
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-heading">Upload more codes</h2>
            <p className="text-xs text-muted-foreground">
              Paste codes one per line (or separated by commas). Duplicates are skipped automatically.
            </p>
          </div>
          <Button variant={open ? 'outline' : 'default'} size="sm" onClick={() => setOpen((o) => !o)}>
            <Upload className="mr-2 h-4 w-4" />
            {open ? 'Cancel' : 'Upload'}
          </Button>
        </div>

        {open && (
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="codes">Codes</Label>
              <textarea
                id="codes"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="WOW-ABCD-1234&#10;WOW-EFGH-5678&#10;..."
                rows={8}
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <p className="text-xs text-muted-foreground">
                {parsed.length === 0
                  ? 'No codes detected yet.'
                  : `${parsed.length} unique code${parsed.length === 1 ? '' : 's'} detected.`}
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {result && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Upload complete</AlertTitle>
                <AlertDescription>
                  Inserted {result.inserted} code{result.inserted === 1 ? '' : 's'}
                  {result.skipped > 0 ? ` · skipped ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'}` : ''}
                  .
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending || parsed.length === 0}>
                {isPending ? 'Uploading…' : `Add ${parsed.length} code${parsed.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
