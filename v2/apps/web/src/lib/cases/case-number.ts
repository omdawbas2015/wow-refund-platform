import { prisma } from '@wow/db';
import { generateCaseNumber } from '@/lib/utils';

/**
 * Generate the next case number for a given country/year combination.
 *
 * Uses the registryCode (ISO alpha-2) of the country and the current year.
 * Looks up the highest existing case number with the same prefix and
 * increments it by one. This is racy under heavy concurrent load — production
 * should add a unique sequence table, but it is good enough for current scale
 * because case creation is interactive (agent driven).
 */
export async function nextCaseNumber(countryId: string, now: Date = new Date()): Promise<string> {
  const country = await prisma.country.findUnique({
    where: { id: countryId },
    select: { registryCode: true },
  });
  if (!country) throw new Error('COUNTRY_NOT_FOUND');

  const year = now.getUTCFullYear();
  const prefix = `REF-${country.registryCode}-${year}-`;

  const last = await prisma.refundCase.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  });

  const lastSeq = last ? parseInt(last.caseNumber.slice(prefix.length), 10) || 0 : 0;
  return generateCaseNumber(country.registryCode, year, lastSeq + 1);
}
