'use server';

import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

const VALID_SCOPES = new Set(['CASES', 'BATCHES', 'PROMOS', 'STORE_MESSAGES', 'DASHBOARD']);

/**
 * Create a saved view for the current user. `filters` is the **raw query
 * string** (without leading `?`) so the page that owns the view stays
 * authoritative for filter shape — no schema migration needed when filters
 * change. Names are unique per user+scope; saving with an existing name
 * overwrites the previous filter string.
 */
export async function createSavedViewAction(input: {
  scope: string;
  name: string;
  filters: string;
  isShared?: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: 'UNAUTHENTICATED' };
    const scope = input.scope?.trim();
    const name = input.name?.trim();
    const filters = input.filters?.trim() ?? '';
    const isShared = !!input.isShared;
    if (!scope || !VALID_SCOPES.has(scope)) return { ok: false, error: 'Invalid scope' };
    if (!name || name.length > 64) return { ok: false, error: 'Name is required (max 64 chars)' };
    if (filters.length > 4000) return { ok: false, error: 'Filters too long' };
    if (isShared && session.user.role !== 'ADMIN') {
      return { ok: false, error: 'Only admins can share views' };
    }

    const existing = await prisma.savedView.findFirst({
      where: { userId: session.user.id, scope, name },
      select: { id: true },
    });
    let id: string;
    if (existing) {
      const updated = await prisma.savedView.update({
        where: { id: existing.id },
        data: { filters, isShared },
        select: { id: true },
      });
      id = updated.id;
    } else {
      const created = await prisma.savedView.create({
        data: {
          userId: session.user.id,
          scope,
          name,
          filters,
          isShared,
        },
        select: { id: true },
      });
      id = created.id;
    }
    revalidatePath('/cases');
    revalidatePath('/promo');
    revalidatePath('/');
    return { ok: true, data: { id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteSavedViewAction(input: {
  id: string;
}): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: 'UNAUTHENTICATED' };
    const view = await prisma.savedView.findUnique({ where: { id: input.id } });
    if (!view) return { ok: false, error: 'Not found' };
    if (view.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return { ok: false, error: 'FORBIDDEN' };
    }
    await prisma.savedView.delete({ where: { id: input.id } });
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * List the saved views the current user can see for a given scope:
 * their own + any view explicitly marked `isShared`.
 */
export async function listSavedViewsAction(scope: string): Promise<
  ActionResult<{
    views: Array<{
      id: string;
      name: string;
      filters: string;
      isShared: boolean;
      mine: boolean;
    }>;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: 'UNAUTHENTICATED' };
    if (!VALID_SCOPES.has(scope)) return { ok: false, error: 'Invalid scope' };
    const rows = await prisma.savedView.findMany({
      where: {
        scope,
        OR: [{ userId: session.user.id }, { isShared: true }],
      },
      orderBy: [{ isShared: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        filters: true,
        isShared: true,
        userId: true,
      },
    });
    return {
      ok: true,
      data: {
        views: rows.map((r) => ({
          id: r.id,
          name: r.name,
          filters: r.filters,
          isShared: r.isShared,
          mine: r.userId === session.user.id,
        })),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
