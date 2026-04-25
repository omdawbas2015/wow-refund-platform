import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const randomElement = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (start: Date, end: Date) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

async function main() {
  const countries = await prisma.country.findMany({ include: { branches: true } });
  const causes = await prisma.rootCause.findMany();
  const agents = await prisma.user.findMany({ where: { role: 'AGENT' } });

  if (!countries.length || !causes.length || !agents.length) {
    console.log("Missing base data. Please run default seed first.");
    return;
  }

  console.log('Generating random mock data...');

  // 1. Generate Promo Codes
  const promoTypes = ['COMPENSATION', 'MARKETING', 'RETENTION'];
  const values = [10, 20, 50, 100];
  
  for (let i = 0; i < 60; i++) {
    const country = randomElement(countries);
    await prisma.promoCode.create({
      data: {
        code: `PROMO-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        type: randomElement(promoTypes),
        value: randomElement(values),
        currency: country.currency || 'KWD',
        countryId: country.id,
        status: Math.random() > 0.6 ? 'USED' : 'AVAILABLE',
        expiresAt: randomDate(new Date(), new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
      }
    });
  }

  // 2. Generate Refund Cases
  const statuses = ['DRAFT', 'DRAFT', 'PENDING_APPROVAL', 'PENDING_REFUND', 'REFUNDED', 'REFUNDED', 'REFUNDED', 'REJECTED'];
  
  // To avoid duplicate case numbers in a loop, we will track counts in memory
  const counts: Record<string, number> = {};
  for (const c of countries) {
    counts[c.id] = await prisma.refundCase.count({ where: { countryId: c.id } });
  }

  for (let i = 0; i < 120; i++) {
    const country = randomElement(countries);
    const branch = randomElement(country.branches);
    const cause = randomElement(causes);
    const agent = randomElement(agents);
    
    counts[country.id]++;
    const caseNumber = `REF-${country.code}-2026-${String(counts[country.id]).padStart(4, '0')}`;
    
    const status = randomElement(statuses);
    // Generate dates within the last 45 days
    const pastDate = randomDate(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), new Date());
    
    const newCase = await prisma.refundCase.create({
      data: {
        caseNumber,
        countryId: country.id,
        branchId: branch.id,
        rootCauseId: cause.id,
        agentId: agent.id,
        customerName: `Customer ${Math.floor(Math.random() * 10000)}`,
        customerEmail: `customer${Math.floor(Math.random() * 10000)}@example.com`,
        customerPhone: `+965${Math.floor(10000000 + Math.random() * 90000000)}`,
        orderNumber: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
        orderDate: new Date(pastDate.getTime() - 5 * 24 * 60 * 60 * 1000),
        orderAmount: Math.floor(20 + Math.random() * 300),
        paymentMethod: randomElement(['CREDIT_CARD', 'CASH', 'APPLE_PAY']),
        refundReason: 'Generated mock reason for testing the system analytics and flows.',
        status: status,
        createdAt: pastDate,
        updatedAt: pastDate,
        contactStatus: randomElement(['PENDING', 'CONTACTED', 'NO_RESPONSE']),
        approvedAt: ['PENDING_REFUND', 'REFUNDED'].includes(status) ? new Date(pastDate.getTime() + (1 * 24 * 60 * 60 * 1000)) : null,
        refundedAt: status === 'REFUNDED' ? new Date(pastDate.getTime() + (3 * 24 * 60 * 60 * 1000)) : null,
      }
    });

    // Create an audit log for it so the dashboard recent activity isn't empty
    await prisma.auditLog.create({
      data: {
        caseId: newCase.id,
        userId: agent.id,
        actionType: 'CASE_CREATED',
        actorName: 'SYSTEM',
        description: `Mock case ${caseNumber} generated for testing`,
        timestamp: pastDate
      }
    });
  }

  console.log('Finished generating 120 refund cases and 60 promo codes!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
