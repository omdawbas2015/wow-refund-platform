import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.refundCase.groupBy({
    by: ['rootCauseId'],
    _count: true
  });
}
main().catch(console.error);
