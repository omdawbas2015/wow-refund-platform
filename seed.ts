import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Seeding ---');

  // Hardcoded cleanup (optional but good for a fresh start)
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.promoUsage.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.refundCase.deleteMany();
  await prisma.refundBatch.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.country.deleteMany();
  await prisma.rootCause.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemConfig.deleteMany();

  // 1. Create System Config
  await prisma.systemConfig.createMany({
    data: [
      { key: 'MAX_REFUND_AMOUNT', value: '500', description: 'Maximum refund amount allowed per case' },
      { key: 'AUTO_REJECT_DAYS', value: '30', description: 'Days before a pending case is auto-rejected' },
      { key: 'PROMO_EXPIRY_DAYS', value: '90', description: 'Standard expiry days for promo codes' },
    ]
  });

  // 2. Create Countries
  const kuwait = await prisma.country.create({
    data: {
      name: 'Kuwait',
      code: 'KW',
      currency: 'KWD',
      managerEmail: 'kuwait-manager@example.com',
    }
  });

  const uae = await prisma.country.create({
    data: {
      name: 'United Arab Emirates',
      code: 'UAE',
      currency: 'AED',
      managerEmail: 'uae-manager@example.com',
    }
  });

  const saudi = await prisma.country.create({
    data: {
      name: 'Saudi Arabia',
      code: 'SA',
      currency: 'SAR',
      managerEmail: 'saudi-manager@example.com',
    }
  });

  // 3. Create Branches
  const kwBranches = await Promise.all([
    prisma.branch.create({ data: { name: 'The Avenues', countryId: kuwait.id } }),
    prisma.branch.create({ data: { name: '360 Mall', countryId: kuwait.id } }),
    prisma.branch.create({ data: { name: 'Al Kout', countryId: kuwait.id } }),
  ]);

  const uaeBranches = await Promise.all([
    prisma.branch.create({ data: { name: 'Dubai Mall', countryId: uae.id } }),
    prisma.branch.create({ data: { name: 'Mall of the Emirates', countryId: uae.id } }),
  ]);

  // 4. Create Root Causes
  const causes = await Promise.all([
    prisma.rootCause.create({ data: { name: 'Damaged Item', description: 'Item received in a broken or unusable state', displayOrder: 1 } }),
    prisma.rootCause.create({ data: { name: 'Faulty Product', description: 'Product has manufacturing defects', displayOrder: 2 } }),
    prisma.rootCause.create({ data: { name: 'Wrong Item Sent', description: 'Customer received something else', displayOrder: 3 } }),
    prisma.rootCause.create({ data: { name: 'Late Delivery', description: 'Customer wants refund due to severe delay', displayOrder: 4 } }),
    prisma.rootCause.create({ data: { name: 'Missing Components', description: 'Items missing from the package', displayOrder: 5 } }),
  ]);

  // 5. Create Users
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Site Administrator',
      role: 'ADMIN',
    }
  });

  const kwAgent = await prisma.user.create({
    data: {
      email: 'kw-agent@example.com',
      password: hashedPassword,
      name: 'Kuwait Ops Agent',
      role: 'AGENT',
      countryId: kuwait.id,
    }
  });

  const uaeAgent = await prisma.user.create({
    data: {
      email: 'uae-agent@example.com',
      password: hashedPassword,
      name: 'UAE Ops Agent',
      role: 'AGENT',
      countryId: uae.id,
    }
  });

  // 6. Create Promo Codes
  await prisma.promoCode.createMany({
    data: [
      { code: 'KW-COMP-10', type: 'CUSTOMER_COMPENSATION', value: 10, currency: 'KWD', countryId: kuwait.id, status: 'AVAILABLE', threshold: 5, expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
      { code: 'KW-COMP-15', type: 'CUSTOMER_COMPENSATION', value: 15, currency: 'KWD', countryId: kuwait.id, status: 'AVAILABLE', threshold: 5 },
      { code: 'UAE-COMP-50', type: 'CUSTOMER_COMPENSATION', value: 50, currency: 'AED', countryId: uae.id, status: 'RESERVED', threshold: 2 },
    ]
  });

  // 7. Create Refund Cases
  const now = new Date();
  
  // Case 1: Draft in Kuwait
  await prisma.refundCase.create({
    data: {
      caseNumber: `REF-KW-${now.getFullYear()}-1001`,
      agentId: kwAgent.id,
      createdById: kwAgent.id,
      orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      orderNumber: 'ORD-KW-4492',
      orderAmount: 85.500,
      paymentMethod: 'KNET',
      rootCauseId: causes[0].id,
      refundReason: 'Customer received a shattered glass vase.',
      countryId: kuwait.id,
      branchId: kwBranches[0].id,
      customerName: 'Ahmad Al-Sabah',
      customerEmail: 'ahmad@example.com',
      customerPhone: '96599001122',
      status: 'DRAFT',
      auditLogs: {
        create: {
          actionType: 'CASE_CREATED',
          userId: kwAgent.id,
          actorName: kwAgent.name,
          description: 'Initial case creation in Draft status.'
        }
      }
    }
  });

  // Case 2: Pending Approval in UAE
  await prisma.refundCase.create({
    data: {
      caseNumber: `REF-UAE-${now.getFullYear()}-1002`,
      agentId: uaeAgent.id,
      createdById: uaeAgent.id,
      orderDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      orderNumber: 'ORD-UAE-8812',
      orderAmount: 450,
      paymentMethod: 'VISA',
      rootCauseId: causes[1].id,
      refundReason: 'Electronics item failed to power on after 2 days.',
      countryId: uae.id,
      branchId: uaeBranches[0].id,
      customerName: 'Fatima Bin Zayed',
      customerEmail: 'fatima@example.com',
      customerPhone: '971501234567',
      status: 'PENDING_APPROVAL',
      auditLogs: {
        createMany: {
          data: [
            { actionType: 'CASE_CREATED', userId: uaeAgent.id, actorName: uaeAgent.name, description: 'Created case for faulty electronic product.' },
            { actionType: 'STATUS_CHANGE', userId: uaeAgent.id, actorName: uaeAgent.name, description: 'Submitted for manager review.', previousState: 'DRAFT', newState: 'PENDING_APPROVAL' }
          ]
        }
      },
      comments: {
        create: {
          userId: uaeAgent.id,
          content: 'Verified the defect with the technical team at Dubai Mall branch.'
        }
      }
    }
  });

  // Case 3: Fully Refunded in Kuwait
  const refundedCase = await prisma.refundCase.create({
    data: {
      caseNumber: `REF-KW-${now.getFullYear()}-1003`,
      agentId: kwAgent.id,
      createdById: kwAgent.id,
      closedById: admin.id,
      orderDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      orderNumber: 'ORD-KW-2211',
      orderAmount: 120.000,
      paymentMethod: 'KNET',
      rootCauseId: causes[2].id,
      refundReason: 'Received small size instead of Large. Item returned.',
      countryId: kuwait.id,
      branchId: kwBranches[1].id,
      customerName: 'Mubarak Ali',
      customerEmail: 'mubarak@example.com',
      customerPhone: '96555667788',
      status: 'REFUNDED',
      contactStatus: 'CONTACTED',
      refundedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      approvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      refundId: 'TXN-KNET-8822001',
      auditLogs: {
        createMany: {
          data: [
            { actionType: 'CASE_CREATED', userId: kwAgent.id, actorName: kwAgent.name, description: 'Case opened for sizing issue.' },
            { actionType: 'STATUS_CHANGE', userId: admin.id, actorName: admin.name, description: 'Approved by manager.', previousState: 'PENDING_APPROVAL', newState: 'APPROVED' },
            { actionType: 'STATUS_CHANGE', userId: admin.id, actorName: admin.name, description: 'Settlement confirmed.', previousState: 'APPROVED', newState: 'REFUNDED' }
          ]
        }
      }
    }
  });

  // Create a promo usage for the refunded case
  const promo = await prisma.promoCode.create({
    data: {
      code: 'KW-SORRY-5',
      type: 'CUSTOMER_COMPENSATION',
      value: 5,
      currency: 'KWD',
      countryId: kuwait.id,
      status: 'USED'
    }
  });

  await prisma.promoUsage.create({
    data: {
      promoCodeId: promo.id,
      caseId: refundedCase.id,
      caseNumber: refundedCase.caseNumber,
      orderNumber: refundedCase.orderNumber,
      usedBy: kwAgent.name,
      agentId: kwAgent.id,
      reason: 'Compensation for sizing inconvenience.'
    }
  });

  console.log('--- Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
