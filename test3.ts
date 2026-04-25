import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const rc = await prisma.rootCause.create({ data: { name: 'Test' } });
    const c = await prisma.country.create({ data: { name: 'Test', code: 'TT' } });
    const b = await prisma.branch.create({ data: { name: 'Test', countryId: c.id } });
    const agent = await prisma.user.create({ data: { email: 't@t.com', name: 't', password: '1', role: 'AGENT' } });
    await prisma.refundCase.create({ data: { 
      caseNumber: '1', rootCauseId: rc.id, countryId: c.id, branchId: b.id, agentId: agent.id,
      orderDate: new Date(), orderNumber: '1', orderAmount: 1, paymentMethod: 'Card', refundReason: 'Test', customerName: 'T', customerEmail: 't@t.com', customerPhone: '1'
    }});
    const res = await prisma.refundCase.groupBy({
      by: ['rootCauseId'],
      _count: { _all: true }
    });
    console.log("groupBy _count: { _all: true } SUCCESS", res);
  } catch(e) {
    console.log("groupBy _count: true FAILED", e.name, e.message);
  }
}

main().catch(console.error);
