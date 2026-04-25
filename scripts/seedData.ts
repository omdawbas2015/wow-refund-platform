import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // Reset collections to allow repeated seeding
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.contactAttempt.deleteMany();
  await prisma.promoUsage.deleteMany();
  await prisma.internalPromoUsage.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.internalPromoCode.deleteMany();
  await prisma.refundCase.deleteMany();

  // 1. Countries
  const kw = await prisma.country.upsert({
    where: { code: 'KW' },
    update: {},
    create: {
      name: 'Kuwait',
      code: 'KW',
      currency: 'KWD',
      managerEmail: 'kw-manager@alshaya.com'
    }
  });

  const sa = await prisma.country.upsert({
    where: { code: 'SA' },
    update: {},
    create: {
      name: 'Saudi Arabia',
      code: 'SA',
      currency: 'SAR',
      managerEmail: 'sa-manager@alshaya.com'
    }
  });

  const ae = await prisma.country.upsert({
    where: { code: 'AE' },
    update: {},
    create: {
      name: 'UAE',
      code: 'AE',
      currency: 'AED',
      managerEmail: 'ae-manager@alshaya.com'
    }
  });

  // 2. Branches
  const branches = [
    { name: 'The Avenues', countryId: kw.id },
    { name: 'Marina Mall', countryId: kw.id },
    { name: 'Red Sea Mall', countryId: sa.id },
    { name: 'Riyadh Park', countryId: sa.id },
    { name: 'Dubai Mall', countryId: ae.id },
    { name: 'Mall of the Emirates', countryId: ae.id },
  ];

  for (const b of branches) {
    await prisma.branch.upsert({
      where: { name_countryId: { name: b.name, countryId: b.countryId } },
      update: {},
      create: b
    });
  }

  // 3. Root Causes
  const rootCauses = [
    { name: 'System Glitch', description: 'Technical error in processing' },
    { name: 'Wrong Item Delivered', description: 'Customer received incorrect order' },
    { name: 'Damage on Delivery', description: 'Item arrived damaged' },
    { name: 'Customer Changed Mind', description: 'Subjective return' },
    { name: 'Payment Failure', description: 'Charged but order not created' },
  ];

  for (const rc of rootCauses) {
    await prisma.rootCause.upsert({
      where: { name: rc.name },
      update: {},
      create: rc
    });
  }

  // 4. Users
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@alshaya.com' },
    update: {},
    create: {
      email: 'admin@alshaya.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: 'ADMIN',
    }
  });

  const agent = await prisma.user.upsert({
    where: { email: 'agent@alshaya.com' },
    update: {},
    create: {
      email: 'agent@alshaya.com',
      password: hashedPassword,
      name: 'John Agent',
      role: 'AGENT',
      countryId: kw.id
    }
  });

  // --- Promo Codes ---
  console.log('Generating promo codes...');
  const countries = [kw, sa, ae];
  for (const country of countries) {
    // Standard codes
    for (let i = 1; i <= 5; i++) {
      await prisma.promoCode.create({
        data: {
          code: `COMP-${country.code}-${i}-${Math.floor(Math.random() * 9000) + 1000}`,
          type: 'CUSTOMER_COMPENSATION',
          value: country.code === 'KW' ? 10 : 50,
          currency: country.currency,
          countryId: country.id,
          requestedBy: 'System Seed',
          status: 'AVAILABLE'
        }
      });
    }
    // Internal 100% codes
    for (let i = 1; i <= 3; i++) {
      await prisma.internalPromoCode.create({
        data: {
          code: `INT100-${country.code}-${i}-${Math.floor(Math.random() * 9000) + 1000}`,
          value: 100, // percentage or fixed depending on how it's used
          currency: country.currency,
          countryId: country.id,
          requestedBy: 'Management Seed',
          status: 'AVAILABLE'
        }
      });
    }
  }

  // 5. Refund Cases
  const statuses = ['DRAFT', 'PENDING_APPROVAL', 'PENDING_REFUND', 'APPROVED', 'REFUNDED'];
  const pMethods = ['Credit Card', 'KNET', 'Cash', 'Tabby/Tamara'];
  
  const allBranches = await prisma.branch.findMany();
  const allCauses = await prisma.rootCause.findMany();

  console.log('Generating cases...');
  for (let i = 1; i <= 30; i++) {
    const branch = allBranches[Math.floor(Math.random() * allBranches.length)];
    const cause = allCauses[Math.floor(Math.random() * allCauses.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const pMethod = pMethods[Math.floor(Math.random() * pMethods.length)];
    const isRefunded = status === 'REFUNDED';
    
    await prisma.refundCase.create({
      data: {
        caseNumber: `REF-${branch.countryId.substring(0,2).toUpperCase()}-2026-${1000 + i}`,
        agentId: agent.id,
        createdById: agent.id,
        closedById: isRefunded ? admin.id : null,
        refundedAt: isRefunded ? new Date() : null,
        orderDate: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000),
        orderNumber: `ORD-${Math.floor(Math.random() * 900000) + 100000}`,
        orderAmount: Math.random() * 200 + 10,
        paymentMethod: pMethod,
        rootCauseId: cause.id,
        refundReason: 'Mock reason for testing the system flows and UI density.',
        countryId: branch.countryId,
        branchId: branch.id,
        customerName: `Customer ${i}`,
        customerEmail: `customer${i}@example.com`,
        customerPhone: `+965 ${Math.floor(Math.random() * 90000000) + 10000000}`,
        status: status,
        auraPoints: Math.random() > 0.7 ? `${Math.floor(Math.random() * 500)}` : null
      }
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
