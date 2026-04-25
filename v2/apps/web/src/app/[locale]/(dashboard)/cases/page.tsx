import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Plus } from 'lucide-react';

export default function CasesPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">Refund Cases</h1>
          <p className="mt-2 text-body">Create, track, and manage customer refund cases.</p>
        </div>
        <Button disabled>
          <Plus className="h-4 w-4" />
          New case
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phase 2 placeholder</CardTitle>
          <CardDescription>
            Case creation, listing, and details will be implemented in Phase 2. The data model is
            already complete — see <code className="font-mono text-xs">packages/db/prisma/schema.prisma</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No cases yet. Case creation ships in Phase 2.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
