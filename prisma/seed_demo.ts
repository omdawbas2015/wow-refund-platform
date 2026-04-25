import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  // 1. Create Admin User
  const hashedPassword = await bcrypt.hash('password123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@wow.com' },
    update: {},
    create: {
      email: 'admin@wow.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: 'ADMIN',
    },
  });
  console.log('Admin user created:', admin.email);

  // 2. Create Brands
  const brands = [
    { name: 'Chipotle', code: 'CHIPOTLE' },
    { name: "Raising Cane's", code: 'RAISINCANES' },
    { name: 'Starbucks', code: 'STARBUCKS' },
  ];

  for (const b of brands) {
    await prisma.brand.upsert({
      where: { code: b.code },
      update: {},
      create: { ...b, isActive: true },
    });
  }
  console.log('Brands seeded.');

  // 3. Create Countries & Branches
  const kuwait = await prisma.country.upsert({
    where: { code: 'KW' },
    update: {},
    create: { name: 'Kuwait', code: 'KW', currency: 'KWD' },
  });

  const branch = await prisma.branch.upsert({
    where: { name_countryId: { name: 'Avenues Mall', countryId: kuwait.id } },
    update: {},
    create: { name: 'Avenues Mall', countryId: kuwait.id },
  });
  console.log('Geography seeded.');

  // 4. Root Causes
  const rootCause = await prisma.rootCause.upsert({
    where: { name: 'Missing Item' },
    update: {},
    create: { name: 'Missing Item', description: 'Item was not delivered' },
  });

  // 5. Create Test Cases
  const brandChipotle = await prisma.brand.findUnique({ where: { code: 'CHIPOTLE' } });
  
  await prisma.refundCase.upsert({
    where: { caseNumber: 'REF-2026-001' },
    update: {},
    create: {
      caseNumber: 'REF-2026-001',
      agentId: admin.id,
      customerName: 'Ahmed Mohamed',
      customerEmail: 'ahmed@example.com',
      customerPhone: '+965 12345678',
      orderNumber: 'ORD-9901',
      orderAmount: 25.5,
      orderDate: new Date(),
      refundReason: 'Item missing from order',
      status: 'PENDING_APPROVAL',
      countryId: kuwait.id,
      branchId: branch.id,
      brandId: brandChipotle?.id,
      rootCauseId: rootCause.id,
    },
  });

  await prisma.refundCase.upsert({
    where: { caseNumber: 'REF-2026-002' },
    update: {},
    create: {
      caseNumber: 'REF-2026-002',
      agentId: admin.id,
      customerName: 'Sara Khaled',
      customerEmail: 'sara@example.com',
      customerPhone: '+965 87654321',
      orderNumber: 'ORD-9902',
      orderAmount: 12.0,
      orderDate: new Date(),
      refundReason: 'Cold food delivered',
      status: 'APPROVED',
      countryId: kuwait.id,
      branchId: branch.id,
      brandId: brandChipotle?.id,
      rootCauseId: rootCause.id,
    },
  });

  console.log('Test cases seeded.');
  console.log('Demo seeding complete!');
  console.log('Login with: admin@wow.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
