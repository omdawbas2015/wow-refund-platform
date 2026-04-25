import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const where = { country: { code: { in: ['US'] } } };
  
  // Test 1: groupBy _count: true
  try {
    await prisma.refundCase.groupBy({
      by: ['rootCauseId'],
      _count: true
    });
    console.log("groupBy _count: true SUCCESS");
  } catch(e) {
    console.log("groupBy _count: true FAILED", e.name, e.message);
  }

  // Test 2: where: { case: where }
  try {
    await prisma.promoUsage.findMany({
      where: { case: where }
    });
    console.log("findMany case: where SUCCESS");
  } catch(e) {
    console.log("findMany case: where FAILED", e.name, e.message);
  }

}

main().catch(console.error);
