import type { Prisma } from '@wow/db';

/**
 * Generate the next sequential batch number for an entity.
 * Caller-provided `tx` keeps the read on the same transaction as the write
 * so duplicate numbers can't slip in under concurrency. Falling back to a
 * unique-violation retry is the responsibility of the caller.
 */

function nextNumber(prefix: string, last: { batchNumber: string } | null): string {
  const lastSeq = last ? Number(last.batchNumber.slice(prefix.length)) : 0;
  const next = (lastSeq + 1).toString().padStart(4, '0');
  return `${prefix}${next}`;
}

export async function generateApprovalBatchNumber(
  tx: Prisma.TransactionClient,
  countryCode: string,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `APB-${countryCode}-${year}-`;
  const last = await tx.approvalBatch.findFirst({
    where: { batchNumber: { startsWith: prefix } },
    orderBy: { batchNumber: 'desc' },
    select: { batchNumber: true },
  });
  return nextNumber(prefix, last);
}

export async function generateKnetBatchNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `KNET-${year}-`;
  const last = await tx.knetBatch.findFirst({
    where: { batchNumber: { startsWith: prefix } },
    orderBy: { batchNumber: 'desc' },
    select: { batchNumber: true },
  });
  return nextNumber(prefix, last);
}

export async function generateAuraBatchNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `AURA-${year}-`;
  const last = await tx.auraBatch.findFirst({
    where: { batchNumber: { startsWith: prefix } },
    orderBy: { batchNumber: 'desc' },
    select: { batchNumber: true },
  });
  return nextNumber(prefix, last);
}
