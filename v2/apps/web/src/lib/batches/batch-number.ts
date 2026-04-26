import { prisma } from '@wow/db';

/**
 * Generate the next approval batch number, e.g. APB-KW-2026-0001.
 * Sequence is per-country/year and naive (no DB sequence yet).
 */
export async function nextApprovalBatchNumber(
  countryId: string,
  now: Date = new Date(),
): Promise<string> {
  const country = await prisma.country.findUnique({
    where: { id: countryId },
    select: { registryCode: true },
  });
  if (!country) throw new Error('COUNTRY_NOT_FOUND');
  const year = now.getUTCFullYear();
  const prefix = `APB-${country.registryCode}-${year}-`;

  const last = await prisma.approvalBatch.findFirst({
    where: { batchNumber: { startsWith: prefix } },
    orderBy: { batchNumber: 'desc' },
    select: { batchNumber: true },
  });
  const lastSeq = last ? parseInt(last.batchNumber.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}

/**
 * KNET batches are global (one queue), e.g. KNET-2026-0001.
 */
export async function nextKnetBatchNumber(now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const prefix = `KNET-${year}-`;
  const last = await prisma.knetBatch.findFirst({
    where: { batchNumber: { startsWith: prefix } },
    orderBy: { batchNumber: 'desc' },
    select: { batchNumber: true },
  });
  const lastSeq = last ? parseInt(last.batchNumber.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}

/**
 * Aura batches are global (one queue), e.g. AURA-2026-0001.
 */
export async function nextAuraBatchNumber(now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const prefix = `AURA-${year}-`;
  const last = await prisma.auraBatch.findFirst({
    where: { batchNumber: { startsWith: prefix } },
    orderBy: { batchNumber: 'desc' },
    select: { batchNumber: true },
  });
  const lastSeq = last ? parseInt(last.batchNumber.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}
