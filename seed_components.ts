import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Demo Seeding ---');

  // Cleanup
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.refundComponent.deleteMany();
  await prisma.refundCase.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.country.deleteMany();
  await prisma.rootCause.deleteMany();
  await prisma.user.deleteMany();

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

  // 5. Create specific cases with components
  
  // Case 1: Split Payment (Credit Card + Aura) -> Pending Approval
  await prisma.refundCase.create({
    data: {
      caseNumber: 'CS-SPLIT-001',
      agentId: agent.id,
      createdById: agent.id,
      orderNumber: 'ORD-SPLIT-101',
      orderDate: new Date(),
      orderAmount: 120.0,
      rootCauseId: cause.id,
      refundReason: 'Customer quality complaint',
      countryId: kuwait.id,
      branchId: kwBranch.id,
      customerName: 'Ahmad Kuwaiti',
      customerEmail: 'ahmad@test.com',
      customerPhone: '9651234567',
      status: 'APPROVED',
      approvedAt: new Date(),
      components: {
        create: [
          { paymentMethod: 'CREDIT_CARD', amount: 100.0, status: 'PENDING_EXECUTION' },
          { paymentMethod: 'AURA', amount: 20.0, status: 'PENDING_EXECUTION' }
        ]
      }
    }
  });

  // Case 2: KNET Only
  await prisma.refundCase.create({
    data: {
      caseNumber: 'CS-KNET-002',
      agentId: agent.id,
      orderNumber: 'ORD-KNET-102',
      orderDate: new Date(),
      orderAmount: 45.0,
      rootCauseId: cause.id,
      refundReason: 'Wrong size sent',
      countryId: kuwait.id,
      branchId: kwBranch.id,
      customerName: 'Sara Ali',
      customerEmail: 'sara@test.com',
      customerPhone: '9657777777',
      status: 'APPROVED',
      approvedAt: new Date(),
      components: {
        create: [
          { paymentMethod: 'KNET', amount: 45.0, status: 'IN_PROGRESS' }
        ]
      }
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
