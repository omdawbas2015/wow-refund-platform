import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.refundCase.groupBy({
      by: ['rootCauseId'],
      _count: true as any
    });
    console.log("groupBy _count: true SUCCESS");
  } catch(e) {
    console.log("groupBy _count: true FAILED", e.name, e.message);
  }
}

main().catch(console.error);
