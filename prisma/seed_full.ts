import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');
  await prisma.internalPromoUsage.deleteMany();
  await prisma.internalPromoCode.deleteMany();
  await prisma.promoUsage.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.contactAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.refundCase.deleteMany();
  await prisma.rootCause.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.country.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemConfig.deleteMany();

  console.log('Seeding fresh database with extensive mock data...');

  // Create Root Causes
  const rootCauses = ['Damaged Product', 'Wrong Item', 'Customer Error', 'System Error', 'Late Delivery'];
  const createdRootCauses = [];
  for (const name of rootCauses) {
    createdRootCauses.push(await prisma.rootCause.create({
      data: { name },
    }));
  }

  // Create Countries & Branches
  const countryData = [
    { name: 'Kuwait', code: 'KW', currency: 'KWD', managerEmail: 'kuwait.manager@alshaya.com', branches: ['The Avenues', '360 Mall', 'Al Kout Mall', 'Marina Mall'] },
    { name: 'Saudi Arabia', code: 'SA', currency: 'SAR', managerEmail: 'saudi.manager@alshaya.com', branches: ['Riyadh Park', 'Red Sea Mall', 'Nakheel Mall', 'Mall of Arabia'] },
    { name: 'United Arab Emirates', code: 'AE', currency: 'AED', managerEmail: 'uae.manager@alshaya.com', branches: ['Dubai Mall', 'Mall of the Emirates', 'Yas Mall', 'Galleria Mall'] },
    { name: 'Qatar', code: 'QA', currency: 'QAR', managerEmail: 'qatar.manager@alshaya.com', branches: ['Doha Festival City', 'Villaggio Mall'] },
    { name: 'Bahrain', code: 'BH', currency: 'BHD', managerEmail: 'bahrain.manager@alshaya.com', branches: ['City Centre Bahrain', 'Seef Mall'] }
  ];

  const createdCountries = [];
  for (const c of countryData) {
    const country = await prisma.country.create({
      data: { name: c.name, code: c.code, managerEmail: c.managerEmail, currency: c.currency },
    });
    createdCountries.push(country);

    for (const bName of c.branches) {
      await prisma.branch.create({
        data: { name: bName, countryId: country.id },
      });
    }
  }

  // Create Users
  const password = await bcrypt.hash('admin123', 10);
  
  const usersToCreate = [
    { email: 'admin@alshaya.com', name: 'Alshaya Admin', role: 'ADMIN' },
    { email: 'omdawbas2015@gmail.com', name: 'Alshaya User', role: 'ADMIN' },
    { email: 'agent1@alshaya.com', name: 'Sara (Agent)', role: 'AGENT' },
    { email: 'agent2@alshaya.com', name: 'Ahmed (Agent)', role: 'AGENT' }
  ];

  for (const u of usersToCreate) {
    await prisma.user.create({
      data: { ...u, password },
    });
  }

  const allRootCauses = await prisma.rootCause.findMany();
  const allCountries = await prisma.country.findMany({ include: { branches: true } });
  const allAgents = await prisma.user.findMany({ where: { role: 'AGENT' } });
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

  // Create System Configs
  const configs = [
    { key: 'approvalBatchTime', value: '12:00', description: 'Daily cron time for approval batches' },
    { key: 'promoLowThreshold', value: '10', description: 'Inventory threshold for low promo warning' },
  ];

  for (const conf of configs) {
    await prisma.systemConfig.create({
      data: conf,
    });
  }

  // Seed Email Templates
  console.log('Seeding Email Templates...');
  const templates = [
    {
      name: 'Standard Approval Request',
      category: 'APPROVAL',
      subject: 'Approval Needed: Refund Request {{caseNumber}}',
      body: 'Dear Manager,\n\nA refund request for {{customerName}} (Order #{{orderNumber}}) for the amount of {{orderAmount}} requires your approval.\n\nReason: {{refundReason}}\n\nPlease review and approve.',
      variables: JSON.stringify(['caseNumber', 'customerName', 'orderNumber', 'orderAmount', 'refundReason'])
    },
    {
      name: 'KNET Refund Confirmation',
      category: 'KNET_REFUND',
      subject: 'KNET Refund Processed: {{orderNumber}}',
      body: 'Hello {{customerName}},\n\nYour KNET refund of {{orderAmount}} has been processed. Transaction ID: {{externalRef}}.\n\nThank you for shopping with us.',
      variables: JSON.stringify(['customerName', 'orderNumber', 'orderAmount', 'externalRef'])
    }
  ];

  for (const t of templates) {
    await prisma.emailTemplate.create({ data: t });
  }

  // Seed External Teams
  console.log('Seeding External Teams...');
  const teams = [
    { name: 'KNET', emailGroup: 'knet.team@alshaya.com', slaHours: 48, escalationEmail: 'knet.management@alshaya.com' },
    { name: 'AURA', emailGroup: 'aura.ops@alshaya.com', slaHours: 24, escalationEmail: 'aura.support@alshaya.com' },
    { name: 'FINANCE', emailGroup: 'finance.refunds@alshaya.com', slaHours: 72 }
  ];

  for (const team of teams) {
    await prisma.externalTeam.create({ data: team });
  }

  // Seed Automation Rules
  console.log('Seeding Automation Rules...');
  const rules = [
    { name: 'Auto Notify KNET', triggerEvent: 'PENDING_EXTERNAL', actionType: 'EMAIL', isActive: true, templateId: (await prisma.emailTemplate.findFirst({ where: { name: 'KNET Refund Confirmation' } }))?.id || '' },
    { name: 'Escalate Delay', triggerEvent: 'SLA_BREACH', actionType: 'ESCALATE', isActive: true }
  ];

  for (const rule of rules) {
    await prisma.automationRule.create({ data: rule });
  }

  // Seed Refund Cases...
  const statuses = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PENDING_REFUND', 'REFUNDED', 'KNET-PENDING REFUND', 'KNET-MANUAL REFUND'];
  const paymentMethods = ['KNET', 'CREDIT_CARD', 'CASH', 'TABBY', 'APPLE_PAY'];

  const createdCases = [];
  console.log('Seeding Refund Cases, Audit Logs, and Comments...');
  for (let i = 0; i < 70; i++) {
    const country = allCountries[Math.floor(Math.random() * allCountries.length)];
    const branch = country.branches[Math.floor(Math.random() * country.branches.length)];
    const rootCause = allRootCauses[Math.floor(Math.random() * allRootCauses.length)];
    const agent = allAgents[Math.floor(Math.random() * allAgents.length)];
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 60)); // Spread over last 60 days

    const isKnet = Math.random() > 0.6; // Higher probability for KNET orders
    const payment = isKnet ? 'KNET' : paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    let status = statuses[Math.floor(Math.random() * statuses.length)] as any;
    
    // Status normalization for KNET vs NON-KNET
    if (payment !== 'KNET' && status.toString().includes('KNET')) {
      status = 'PENDING_REFUND';
    }

    const orderAmt = Math.floor(Math.random() * 500) + 50;
    const isPartial = Math.random() > 0.7; // 30% chance of partial refund
    const refundAmt = isPartial ? parseFloat((orderAmt * (Math.random() * 0.5 + 0.1)).toFixed(2)) : orderAmt;

    const hasAura = Math.random() > 0.7;
    const auraVal = hasAura ? parseFloat((refundAmt * 0.2).toFixed(2)) : 0;
    const cashVal = parseFloat((refundAmt - auraVal).toFixed(2));

    const componentsData = [];
    if (hasAura) {
      componentsData.push({
        paymentMethod: 'AURA',
        amount: auraVal,
        status: status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED' ? 'COMPLETED' : 'PENDING_EXECUTION'
      });
    }
    
    // Some cash value.
    if (cashVal > 0) {
      componentsData.push({
        paymentMethod: payment,
        amount: cashVal,
        status: status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED' || status === 'KNET-MANUAL REFUND' ? 'COMPLETED' : 'PENDING_EXECUTION'
      });
    }
    
    if (status === 'PARTIALLY_REFUNDED' || (status === 'REFUNDED' && isPartial)) {
      status = 'PARTIALLY_REFUNDED';
    }

    // Add intermediate processing statuses
    if (status === 'APPROVED' && componentsData.length > 1 && Math.random() > 0.5) {
       status = 'PROCESSING_EXECUTION';
       // Make one completed, one pending
       if (componentsData.length > 1) {
          componentsData[0].status = 'COMPLETED';
          componentsData[0].externalRef = `TRX-${Math.floor(Math.random() * 9000)}`;
       }
    }

    const refundCase = await prisma.refundCase.create({
      data: {
        caseNumber: `RC-${country.code}-${2026}${String(i+1).padStart(5, '0')}`,
        customerName: `Customer ${i+100}`,
        customerEmail: `customer${i+100}@example.com`,
        customerPhone: `+965 999888${i.toString().padStart(2, '0')}`,
        orderNumber: `ORD-${10000 + i}`,
        orderDate: new Date(date.getTime() - 2 * 24*60*60*1000), // Order was 2 days before case
        orderAmount: orderAmt,
        partialAmount: isPartial ? refundAmt : null,
        paymentMethod: payment,
        authCode: payment === 'KNET' ? `AUTH${Math.floor(Math.random() * 90000) + 10000}` : null,
        auraPoints: hasAura ? `${Math.floor(auraVal * 10)}` : null,
        refundReason: 'Customer reported a severe defect on arrival. ' + rootCause.name,
        status: status,
        countryId: country.id,
        branchId: branch.id,
        rootCauseId: rootCause.id,
        agentId: agent.id,
        createdAt: date,
        updatedAt: date,
        components: {
          create: componentsData
        }
      }
    });
    createdCases.push(refundCase);

    // Create realistic Audit Logs for this case
    await prisma.auditLog.create({
      data: {
        caseId: refundCase.id,
        userId: agent.id,
        actionType: 'CASE_CREATED',
        actorName: 'SYSTEM',
        description: 'Case initiated by agent.',
        timestamp: refundCase.createdAt
      }
    });

    // Create realistic comments
    if (Math.random() > 0.4) {
      await prisma.comment.create({
        data: {
          caseId: refundCase.id,
          userId: agent.id,
          content: 'Followed up with customer to verify images of defect. Awaiting manager approval.',
          createdAt: new Date(refundCase.createdAt.getTime() + 60 * 60 * 1000)
        }
      });
    }
  }

  // Seed promo codes and simulate real usage
  console.log('Seeding Promos and Usages...');
  for (const country of allCountries) {
    const values = [5, 10, 20];
    
    // 1. Standard Compensation Promos
    for (const val of values) {
      for (let j = 0; j < 25; j++) {
        // Leave majority AVAILABLE, mark some as USED
        const isUsed = Math.random() < 0.2; 
        const promo = await prisma.promoCode.create({
          data: {
            code: `${country.code}-COMP-${val}-${Math.random().toString(36).substring(7).toUpperCase()}`,
            type: 'COMPENSATION',
            value: val,
            currency: country.currency || 'KWD',
            countryId: country.id,
            status: isUsed ? 'USED' : 'AVAILABLE'
          }
        });

        // Link usage if USED
        if (isUsed) {
          // Grab a random case from this country
          const casesForCountry = createdCases.filter(c => c.countryId === country.id);
          const randomCase = casesForCountry.length > 0 ? casesForCountry[Math.floor(Math.random() * casesForCountry.length)] : null;
          
          await prisma.promoUsage.create({
            data: {
              promoCodeId: promo.id,
              caseId: randomCase ? randomCase.id : null,
              caseNumber: randomCase ? randomCase.caseNumber : `RC-MOCK-${Math.floor(Math.random() * 1000)}`,
              orderNumber: randomCase ? randomCase.orderNumber : `ORD-MOCK-${Math.floor(Math.random() * 1000)}`,
              usedBy: randomCase ? randomCase.customerEmail : 'mock@example.com',
              reason: 'Customer compensation for delay',
              usedAt: new Date(new Date().getTime() - Math.floor(Math.random() * 10) * 24*60*60*1000)
            }
          });
        }
      }
    }
    
    // 2. 100% INTERNAL Promo Codes
    for (let j = 0; j < 20; j++) {
      const isUsed = Math.random() < 0.3;
      const internalPromo = await prisma.internalPromoCode.create({
        data: {
          code: `${country.code}-INT100-${Math.random().toString(36).substring(7).toUpperCase()}`,
          value: 100,
          currency: country.currency || 'KWD',
          countryId: country.id,
          status: isUsed ? 'USED' : 'AVAILABLE'
        }
      });

      if (isUsed) {
        await prisma.internalPromoUsage.create({
          data: {
            promoCodeId: internalPromo.id,
            caseNumber: `RC-${country.code}-INTX-${Math.floor(Math.random() * 9999)}`,
            orderNumber: `ORD-INT-${Math.floor(Math.random() * 9999)}`,
            customerName: 'Internal Mktg Dept',
            customerEmail: 'marketing@alshaya.com',
            usedBy: adminUser!.email,
            reason: 'Influencer campaign gift',
            usedAt: new Date(new Date().getTime() - Math.floor(Math.random() * 5) * 24*60*60*1000)
          }
        });
      }
    }
  }

  console.log('Seeding fully complete! Realism applied to all components.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
