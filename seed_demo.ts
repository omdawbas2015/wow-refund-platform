import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Demo Seeding ---');

  // Cleanup
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.promoUsage.deleteMany();
  await prisma.internalPromoUsage.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.internalPromoCode.deleteMany();
  await prisma.refundCase.deleteMany();
  await prisma.refundBatch.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.country.deleteMany();
  await prisma.rootCause.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemConfig.deleteMany();

  // 1. Create Countries
  const kuwait = await prisma.country.create({
    data: { name: 'Kuwait', code: 'KW', currency: 'KWD', managerEmail: 'kw-fin@example.com' }
  });

  const uae = await prisma.country.create({
    data: { name: 'United Arab Emirates', code: 'UAE', currency: 'AED', managerEmail: 'uae-fin@example.com' }
  });

  // 2. Create Branches
  const kwBranch = await prisma.branch.create({ data: { name: 'The Avenues', countryId: kuwait.id } });
  const uaeBranch = await prisma.branch.create({ data: { name: 'Dubai Mall', countryId: uae.id } });

  // 3. Create Root Causes
  const cause = await prisma.rootCause.create({ data: { name: 'Faulty Item', displayOrder: 1 } });

  // 4. Create Users
  const hashedPassword = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.create({
    data: { email: 'admin@example.com', password: hashedPassword, name: 'Main Admin', role: 'ADMIN' }
  });

  const agent = await prisma.user.create({
    data: { email: 'agent@example.com', password: hashedPassword, name: 'Ops Agent', role: 'AGENT', countryId: kuwait.id }
  });

  // 5. Create Promo Codes (Fixing the Type Mismatch)
  // Type should be 'COMPENSATION' as expected by frontend and backend logic
  await prisma.promoCode.createMany({
    data: [
      { code: 'KW-TEN', type: 'COMPENSATION', value: 10, currency: 'KWD', countryId: kuwait.id, status: 'AVAILABLE' },
      { code: 'KW-FIFTEEN', type: 'COMPENSATION', value: 15, currency: 'KWD', countryId: kuwait.id, status: 'AVAILABLE' },
      { code: 'UAE-FIFTY', type: 'COMPENSATION', value: 50, currency: 'AED', countryId: uae.id, status: 'AVAILABLE' },
    ]
  });

  await prisma.internalPromoCode.createMany({
    data: [
      { code: 'INT-KW-100-A', type: 'INTERNAL_100', value: 100, currency: 'KWD', countryId: kuwait.id, status: 'AVAILABLE' },
      { code: 'INT-UAE-100-B', type: 'INTERNAL_100', value: 100, currency: 'AED', countryId: uae.id, status: 'AVAILABLE' },
    ]
  });

  // 6. Create Cases for different Hub states
  
  // Case A: Pending KNET Settlement (Will show in KNET queue)
  await prisma.refundCase.create({
    data: {
      caseNumber: 'CS-KNET-001',
      agentId: agent.id,
      createdById: agent.id,
      orderNumber: 'ORD-101',
      orderDate: new Date(),
      orderAmount: 120.0,
      paymentMethod: 'KNET',
      rootCauseId: cause.id,
      refundReason: 'Customer quality complaint',
      countryId: kuwait.id,
      branchId: kwBranch.id,
      customerName: 'Ahmad Kuwaiti',
      customerEmail: 'ahmad@test.com',
      customerPhone: '9651234567',
      status: 'APPROVED',
      approvedAt: new Date()
    }
  });

  // Case B: Pending Other Refund (VISA) (Will show in Other Methods)
  await prisma.refundCase.create({
    data: {
      caseNumber: 'CS-VISA-002',
      agentId: agent.id,
      orderNumber: 'ORD-102',
      orderDate: new Date(),
      orderAmount: 45.0,
      paymentMethod: 'VISA',
      rootCauseId: cause.id,
      refundReason: 'Wrong size sent',
      countryId: kuwait.id,
      branchId: kwBranch.id,
      customerName: 'Sara Ali',
      customerEmail: 'sara@test.com',
      customerPhone: '9657777777',
      status: 'APPROVED',
      approvedAt: new Date()
    }
  });

  // Case C: Aura Reversal Pending
  await prisma.refundCase.create({
    data: {
      caseNumber: 'CS-AURA-003',
      agentId: agent.id,
      orderNumber: 'ORD-103',
      orderDate: new Date(),
      orderAmount: 300.0,
      paymentMethod: 'KNET',
      rootCauseId: cause.id,
      refundReason: 'Returning premium item',
      countryId: uae.id,
      branchId: uaeBranch.id,
      customerName: 'John Doe',
      customerEmail: 'john@test.com',
      customerPhone: '971555555',
      status: 'REFUNDED', // Reversals usually happen after cash refund or in parallel
      auraPoints: '500',
      auraStatus: 'PENDING',
      approvedAt: new Date(),
      refundedAt: new Date()
    }
  });

  // Case D: Draft Case for Promo Request Testing
  await prisma.refundCase.create({
    data: {
      caseNumber: 'CS-PROMO-004',
      agentId: agent.id,
      orderNumber: 'ORD-104',
      orderDate: new Date(),
      orderAmount: 50.0,
      paymentMethod: 'KNET',
      rootCauseId: cause.id,
      refundReason: 'Delayed delivery compensation',
      countryId: kuwait.id,
      branchId: kwBranch.id,
      customerName: 'Mohammad Al-Khaldi',
      customerEmail: 'mohammad@test.com',
      customerPhone: '965000000',
      status: 'DRAFT'
    }
  });

  console.log('--- Demo Seeding Completed ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
