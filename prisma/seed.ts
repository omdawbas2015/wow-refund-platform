import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Root Causes
  const rootCauses = ['Damaged Product', 'Wrong Item', 'Customer Error', 'System Error', 'Late Delivery'];
  for (const name of rootCauses) {
    await prisma.rootCause.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Create Countries & Branches
  const countryData = [
    { name: 'Kuwait', code: 'KW', currency: 'KWD', managerEmail: 'kuwait.manager@alshaya.com', branches: ['The Avenues', '360 Mall', 'Al Kout Mall', 'Marina Mall'] },
    { name: 'Saudi Arabia', code: 'SA', currency: 'SAR', managerEmail: 'saudi.manager@alshaya.com', branches: ['Riyadh Park', 'Red Sea Mall', 'Nakheel Mall', 'Mall of Arabia'] },
    { name: 'United Arab Emirates', code: 'AE', currency: 'AED', managerEmail: 'uae.manager@alshaya.com', branches: ['Dubai Mall', 'Mall of the Emirates', 'Yas Mall', 'Galleria Mall'] },
    { name: 'Qatar', code: 'QA', currency: 'QAR', managerEmail: 'qatar.manager@alshaya.com', branches: ['Doha Festival City', 'Villaggio Mall'] },
    { name: 'Bahrain', code: 'BH', currency: 'BHD', managerEmail: 'bahrain.manager@alshaya.com', branches: ['City Centre Bahrain', 'Seef Mall'] },
    { name: 'Oman', code: 'OM', currency: 'OMR', managerEmail: 'oman.manager@alshaya.com', branches: ['Mall of Oman', 'City Centre Muscat'] },
    { name: 'Egypt', code: 'EG', currency: 'EGP', managerEmail: 'egypt.manager@alshaya.com', branches: ['Cairo Festival City', 'Mall of Egypt'] },
    { name: 'Jordan', code: 'JO', currency: 'JOD', managerEmail: 'jordan.manager@alshaya.com', branches: ['City Mall Amman', 'Taj Mall'] },
  ];

  for (const c of countryData) {
    const country = await prisma.country.upsert({
      where: { code: c.code },
      update: { managerEmail: c.managerEmail, currency: c.currency },
      create: { name: c.name, code: c.code, managerEmail: c.managerEmail, currency: c.currency },
    });

    for (const bName of c.branches) {
      await prisma.branch.upsert({
        where: { name_countryId: { name: bName, countryId: country.id } },
        update: {},
        create: { name: bName, countryId: country.id },
      });
    }
  }

  // Create Users
  const password = await bcrypt.hash('admin123', 10);
  
  // Create multiple agents for variety
  const usersToCreate = [
    { email: 'admin@alshaya.com', name: 'Alshaya Ops Admin', role: 'ADMIN' },
    { email: 'agent.sara@alshaya.com', name: 'Sara Al-Fadhli', role: 'AGENT' },
    { email: 'agent.ahmed@alshaya.com', name: 'Ahmed Mansour', role: 'AGENT' },
    { email: 'agent.james@alshaya.com', name: 'James Wilson', role: 'AGENT' },
    { email: 'agent.noor@alshaya.com', name: 'Noor Al-Sabah', role: 'AGENT' },
  ];

  for (const u of usersToCreate) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password },
    });
  }

  // Create System Configs
  const configs = [
    { key: 'approvalBatchTime', value: '12:00', description: 'Daily cron time for approval batches' },
    { key: 'promoLowThreshold', value: '10', description: 'Inventory threshold for low promo warning' },
    { key: 'tokenExpiryHours', value: '72', description: 'Hours before email approval token expires' },
  ];

  for (const conf of configs) {
    await prisma.systemConfig.upsert({
      where: { key: conf.key },
      update: {},
      create: conf,
    });
  }

  console.log('Seeding completed.');

  // Create Sample Cases for Analytics
  const allRootCauses = await prisma.rootCause.findMany();
  const allCountries = await prisma.country.findMany({ include: { branches: true } });
  const allAgents = await prisma.user.findMany({ where: { role: 'AGENT' } });
  
  const customerNames = [
    'Abdullah Al-Enizi', 'Fatima Al-Sayed', 'Mohamed Hassan', 'Youssef Khalil',
    'Asha Varughese', 'Sarah Jenkins', 'Omar Al-Bakr', 'Laila Mahran',
    'Khaled Al-Rashidi', 'Zainab Qassim', 'John Doe', 'Mariam Fouad'
  ];

  if (allAgents.length > 0) {
    console.log('Generating high-fidelity sample cases...');
    const statuses = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PENDING_REFUND', 'REFUNDED'];
    const paymentMethods = ['KNET', 'CREDIT_CARD', 'CASH', 'TABBY', 'TAMARA'];
    
    // Clear existing data to ensure fresh state if needed (optional but helpful for "real" look)
    // await prisma.promoUsage.deleteMany();
    // await prisma.customerContact.deleteMany();
    // await prisma.refundCase.deleteMany();

    for (let i = 0; i < 150; i++) {
      const country = allCountries[Math.floor(Math.random() * allCountries.length)];
      const branch = country.branches[Math.floor(Math.random() * country.branches.length)];
      const rootCause = allRootCauses[Math.floor(Math.random() * allRootCauses.length)];
      
      // Bias towards REFUNDED for analytics beauty
      const statusRoll = Math.random();
      let status = 'REFUNDED';
      if (statusRoll < 0.15) status = 'PENDING_APPROVAL';
      else if (statusRoll < 0.25) status = 'PENDING_REFUND';
      else if (statusRoll < 0.35) status = 'REJECTED';

      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 90)); // Last 90 days

      const caseNum = `RC-${country.code}-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}-${String(i + 1342).padStart(5, '0')}`;
      const amount = 5 + Math.random() * 250;
      
      const refundedAt = status === 'REFUNDED' ? new Date(new Date(date).getTime() + (Math.random() * 5 + 1) * 24 * 60 * 60 * 1000) : null;

      const newCase = await prisma.refundCase.create({
        data: {
          caseNumber: caseNum,
          customerName: customerNames[Math.floor(Math.random() * customerNames.length)],
          customerEmail: `customer.${i}@example.com`,
          customerPhone: `+9${i}${Math.floor(Math.random() * 10000000)}`,
          orderNumber: `800${100000 + i}`,
          orderDate: new Date(date.getTime() - 2 * 24*60*60*1000),
          orderAmount: amount,
          paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
          refundReason: 'The item reached the customer with a clear defect on the packaging and the product itself was scratched. Customer is very unhappy.',
          status: status as any,
          countryId: country.id,
          branchId: branch.id,
          rootCauseId: rootCause.id,
          agentId: allAgents[Math.floor(Math.random() * allAgents.length)].id,
          createdAt: date,
          updatedAt: refundedAt || date,
          refundedAt: refundedAt
        }
      });

      // Add realistic contact attempts
      if (Math.random() > 0.3) {
        const results = ['ANSWERED', 'NO_ANSWER'];
        const numContacts = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < numContacts; j++) {
          await prisma.contactAttempt.create({
            data: {
              caseId: newCase.id,
              result: results[Math.floor(Math.random() * results.length)],
              agentId: newCase.agentId,
              timestamp: new Date(newCase.createdAt.getTime() + (j * 12) * 60 * 60 * 1000)
            }
          });
        }
      }
    }
    console.log('150 Realistic cases generated.');

    // Create Sample Promo Codes & Usages
    console.log('Generating promo codes and linking usages...');
    for (const country of allCountries) {
      const types = ['COMPENSATION', 'SERVICE_RECOVERY'];
      const values = [5, 10, 20];
      
      for (const val of values) {
        for (const type of types) {
          for (let j = 0; j < 10; j++) {
            const promo = await prisma.promoCode.create({
              data: {
                code: `${country.code}-${type.substring(0,2)}-${val}-${Math.random().toString(36).substring(7).toUpperCase()}`,
                type: type,
                value: val,
                currency: country.currency || 'KWD',
                countryId: country.id,
                status: 'AVAILABLE'
              }
            });

            // Use some promos in existing cases
            if (j < 3) {
              const eligibleCases = await prisma.refundCase.findMany({ 
                where: { countryId: country.id, promoUsages: { none: {} } },
                take: 1 
              });
              if (eligibleCases.length > 0) {
                await prisma.promoUsage.create({
                  data: {
                    caseId: eligibleCases[0].id,
                    promoCodeId: promo.id,
                    caseNumber: eligibleCases[0].caseNumber,
                    usedBy: eligibleCases[0].customerEmail,
                    usedAt: eligibleCases[0].createdAt,
                    reason: 'Automated compensation for service delay/issue.'
                  }
                });
                await prisma.promoCode.update({
                  where: { id: promo.id },
                  data: { status: 'USED' }
                });
              }
            }
          }
        }
      }
    }
    console.log('Promo data generated.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
