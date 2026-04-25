import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding new mock data for flags and internal promos...');

  // Insertion logic
  const standardCountries = [
    { name: 'Kuwait', code: 'KW', currency: 'KWD' },
    { name: 'Saudi Arabia', code: 'SA', currency: 'SAR' },
    { name: 'UAE', code: 'AE', currency: 'AED' },
    { name: 'United Kingdom', code: 'GB', currency: 'GBP' }
  ];

  for (const sc of standardCountries) {
    await prisma.country.upsert({
      where: { code: sc.code },
      update: { name: sc.name, currency: sc.currency },
      create: { name: sc.name, code: sc.code, currency: sc.currency, isActive: true }
    });
  }

  // Clear internal promos
  await prisma.internalPromoUsage.deleteMany({});
  await prisma.internalPromoCode.deleteMany({});
  
  const kw = await prisma.country.findUnique({ where: { code: 'KW' } });
  const sa = await prisma.country.findUnique({ where: { code: 'SA' } });
  const ae = await prisma.country.findUnique({ where: { code: 'AE' } });

  console.log('Injecting Internal 100% Promos...');
  const internalData = [];
  for(let i=0; i<10; i++) {
    internalData.push({ code: `INT-KWD-100-${crypto.randomUUID().substring(0,8).toUpperCase()}`, value: 100, currency: 'KWD', countryId: kw.id, status: 'AVAILABLE' });
    internalData.push({ code: `INT-SAR-100-${crypto.randomUUID().substring(0,8).toUpperCase()}`, value: 100, currency: 'SAR', countryId: sa.id, status: 'AVAILABLE' });
    internalData.push({ code: `INT-AED-100-${crypto.randomUUID().substring(0,8).toUpperCase()}`, value: 100, currency: 'AED', countryId: ae.id, status: 'AVAILABLE' });
  }
  await prisma.internalPromoCode.createMany({ data: internalData });

  console.log('Injecting Standard Compensation Promos...');
  const stdData = [];
  for(let i=0; i<10; i++) {
    stdData.push({ code: `CMP-KWD-20-${crypto.randomUUID().substring(0,8).toUpperCase()}`, value: 20, currency: 'KWD', type: 'COMPENSATION', countryId: kw.id, status: 'AVAILABLE' });
    stdData.push({ code: `CMP-SAR-150-${crypto.randomUUID().substring(0,8).toUpperCase()}`, value: 150, currency: 'SAR', type: 'COMPENSATION', countryId: sa.id, status: 'AVAILABLE' });
  }
  await prisma.promoCode.createMany({ data: stdData });

  console.log('Mock Cases & Promos seeded successfully');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
