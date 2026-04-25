/**
 * Prisma seed script.
 * Idempotent: safe to run multiple times.
 * Seeds: currencies, countries, payment methods, root causes, roles, permissions,
 *        email templates, store message templates, default admin user.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  currencies,
  countries as countryRegistryData,
  paymentMethods,
  rootCauses,
  roles as roleSeeds,
  permissions as permissionSeeds,
  emailTemplates,
  storeMessageTemplates,
} from '../src/seed-data';

const prisma = new PrismaClient();

async function seedCurrencies() {
  console.log(`→ Seeding ${currencies.length} currencies...`);
  for (const c of currencies) {
    await prisma.currencyRegistry.upsert({
      where: { code: c.code },
      create: c,
      update: c,
    });
  }
}

async function seedCountryRegistry() {
  console.log(`→ Seeding ${countryRegistryData.length} countries (registry)...`);
  for (const c of countryRegistryData) {
    await prisma.countryRegistry.upsert({
      where: { code: c.code },
      create: c,
      update: c,
    });
  }
}

async function seedPaymentMethods() {
  console.log(`→ Seeding ${paymentMethods.length} payment methods...`);
  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { key: pm.key },
      create: pm,
      update: pm,
    });
  }
}

async function seedRootCauses() {
  console.log(`→ Seeding ${rootCauses.length} root causes...`);
  for (const rc of rootCauses) {
    await prisma.rootCause.upsert({
      where: { key: rc.key },
      create: rc,
      update: rc,
    });
  }
}

async function seedPermissionsAndRoles() {
  console.log(`→ Seeding ${permissionSeeds.length} permissions...`);
  for (const p of permissionSeeds) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: p,
      update: { category: p.category, description: p.description },
    });
  }

  console.log(`→ Seeding ${roleSeeds.length} roles...`);
  for (const r of roleSeeds) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      create: {
        key: r.key,
        name: r.name,
        nameAr: r.nameAr,
        description: r.description,
        isSystem: r.isSystem,
      },
      update: {
        name: r.name,
        nameAr: r.nameAr,
        description: r.description,
        isSystem: r.isSystem,
      },
    });

    // Wipe and set permissions for the role (idempotent)
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms = await prisma.permission.findMany({
      where: { key: { in: r.permissions } },
    });
    for (const p of perms) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id },
      });
    }
  }
}

async function seedEmailTemplates() {
  console.log(`→ Seeding ${emailTemplates.length} email templates...`);
  for (const t of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: {
        key_locale: { key: t.key, locale: t.locale },
      },
      create: {
        key: t.key,
        category: t.category,
        locale: t.locale,
        subject: t.subject,
        body: t.body,
        placeholders: JSON.stringify(t.placeholders),
        description: t.description,
      },
      update: {
        category: t.category,
        subject: t.subject,
        body: t.body,
        placeholders: JSON.stringify(t.placeholders),
        description: t.description,
      },
    });
  }
}

async function seedStoreMessageTemplates() {
  console.log(`→ Seeding ${storeMessageTemplates.length} store message templates...`);
  for (const t of storeMessageTemplates) {
    await prisma.storeMessageTemplate.upsert({
      where: { key: t.key },
      create: t,
      update: t,
    });
  }
}

async function seedActiveCountries() {
  // Activate GCC countries by default (admin can activate more from UI).
  const GCC_ACTIVE = ['KW', 'SA', 'AE', 'BH', 'OM', 'QA'];
  console.log(`→ Activating ${GCC_ACTIVE.length} GCC countries by default...`);
  for (let i = 0; i < GCC_ACTIVE.length; i++) {
    const code = GCC_ACTIVE[i]!;
    const reg = await prisma.countryRegistry.findUnique({ where: { code } });
    if (!reg) continue;
    await prisma.country.upsert({
      where: { registryCode: code },
      create: {
        registryCode: code,
        isActive: true,
        cutoffTime: '17:00',
        sortOrder: i * 10,
      },
      update: {},
    });
  }
}

async function seedDefaultBrands() {
  console.log('→ Seeding default brands...');
  const brands = [
    { name: 'Chipotle', nameAr: 'تشيبوتلي', slug: 'chipotle', sortOrder: 10 },
    { name: 'Starbucks', nameAr: 'ستاربكس', slug: 'starbucks', sortOrder: 20 },
    { name: 'Victoria\'s Secret', nameAr: 'فيكتوريا سيكريت', slug: 'victorias-secret', sortOrder: 30 },
    { name: 'Bath & Body Works', nameAr: 'باث أند بودي ووركس', slug: 'bath-body-works', sortOrder: 40 },
  ];
  for (const b of brands) {
    await prisma.brand.upsert({
      where: { slug: b.slug },
      create: b,
      update: b,
    });
  }
}

async function seedDefaultAdmin() {
  const email = 'admin@wow.local';
  const password = 'admin123';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`→ Default admin already exists (${email})`);
    return;
  }

  const role = await prisma.role.findUnique({ where: { key: 'ADMIN' } });
  if (!role) throw new Error('ADMIN role not seeded');

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name: 'Default Admin',
      nameAr: 'مدير افتراضي',
      status: 'ACTIVE',
      passwordHash,
      mustChangePassword: false,
      roleId: role.id,
      approvedAt: new Date(),
      preferredLocale: 'en',
    },
  });
  console.log(`→ Created default admin: ${email} / ${password}`);
}

async function seedDemoCases() {
  // Only seed demo cases when explicitly requested.
  if (process.env['SEED_DEMO_CASES'] !== '1') {
    console.log('→ Skipping demo cases (set SEED_DEMO_CASES=1 to seed)');
    return;
  }

  // Skip if any cases already exist
  const existing = await prisma.refundCase.count();
  if (existing > 0) {
    console.log(`→ Demo cases skipped (${existing} cases already exist)`);
    return;
  }

  console.log('→ Seeding demo refund cases...');

  const admin = await prisma.user.findUnique({ where: { email: 'admin@wow.local' } });
  const kuwait = await prisma.country.findUnique({ where: { registryCode: 'KW' } });
  const saudi = await prisma.country.findUnique({ where: { registryCode: 'SA' } });
  const chipotle = await prisma.brand.findUnique({ where: { slug: 'chipotle' } });
  const starbucks = await prisma.brand.findUnique({ where: { slug: 'starbucks' } });
  const applePay = await prisma.paymentMethod.findUnique({ where: { key: 'APPLE_PAY' } });
  const knet = await prisma.paymentMethod.findUnique({ where: { key: 'KNET' } });
  const card = await prisma.paymentMethod.findUnique({ where: { key: 'CREDIT_CARD' } });
  const rootCause = await prisma.rootCause.findFirst();

  if (!admin || !kuwait || !saudi || !chipotle || !starbucks || !applePay || !knet || !card) {
    console.log('  ! Missing prerequisites, skipping demo cases');
    return;
  }

  type Demo = {
    countryId: string;
    brandId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    orderNumber: string;
    orderAmount: number;
    orderCurrency: string;
    status: string;
    components: Array<{ paymentMethodId: string; amount: number; authCode?: string; last4?: string }>;
    notes?: string[];
  };

  const demos: Demo[] = [
    {
      countryId: kuwait.id,
      brandId: chipotle.id,
      customerName: 'Sara Al-Fahad',
      customerEmail: 'sara.fahad@example.com',
      customerPhone: '+96599887766',
      orderNumber: 'CHP-KW-89231',
      orderAmount: 12.5,
      orderCurrency: 'KWD',
      status: 'DRAFT',
      components: [{ paymentMethodId: applePay.id, amount: 12.5, last4: '4242' }],
      notes: ['Customer reported missing items in delivery.'],
    },
    {
      countryId: kuwait.id,
      brandId: starbucks.id,
      customerName: 'Omar Khan',
      customerEmail: 'omar.k@example.com',
      customerPhone: '+96566554433',
      orderNumber: 'SBX-KW-44102',
      orderAmount: 8.75,
      orderCurrency: 'KWD',
      status: 'PENDING_APPROVAL',
      components: [{ paymentMethodId: knet.id, amount: 8.75, authCode: 'A12B34' }],
      notes: ['Drink prepared incorrectly twice.', 'Manager confirmed full refund.'],
    },
    {
      countryId: saudi.id,
      brandId: chipotle.id,
      customerName: 'Layla Hussain',
      customerEmail: 'layla.h@example.com',
      customerPhone: '+966500112233',
      orderNumber: 'CHP-SA-77345',
      orderAmount: 95.0,
      orderCurrency: 'SAR',
      status: 'APPROVED',
      components: [{ paymentMethodId: card.id, amount: 95.0, last4: '8821' }],
    },
    {
      countryId: kuwait.id,
      brandId: chipotle.id,
      customerName: 'Yousef Al-Mutairi',
      customerEmail: 'yousef.m@example.com',
      customerPhone: '+96598765432',
      orderNumber: 'CHP-KW-92044',
      orderAmount: 22.0,
      orderCurrency: 'KWD',
      status: 'PARTIALLY_REFUNDED',
      components: [
        { paymentMethodId: applePay.id, amount: 12.0, last4: '5454' },
        { paymentMethodId: knet.id, amount: 8.0, authCode: 'C44D77' },
      ],
    },
    {
      countryId: saudi.id,
      brandId: starbucks.id,
      customerName: 'Reem Al-Saud',
      customerEmail: 'reem.s@example.com',
      customerPhone: '+966512345678',
      orderNumber: 'SBX-SA-22198',
      orderAmount: 60.0,
      orderCurrency: 'SAR',
      status: 'REFUNDED',
      components: [{ paymentMethodId: card.id, amount: 60.0, last4: '1234' }],
      notes: ['Refund completed via Stripe.'],
    },
  ];

  for (let i = 0; i < demos.length; i++) {
    const d = demos[i]!;
    const country = await prisma.country.findUnique({
      where: { id: d.countryId },
      include: { registry: true },
    });
    if (!country) continue;

    const year = new Date().getFullYear();
    const caseNumber = `REF-${country.registry.code}-${year}-${(i + 1).toString().padStart(6, '0')}`;
    const totalRefund = d.components.reduce((s, c) => s + c.amount, 0);
    const isPartial = Math.abs(totalRefund - d.orderAmount) > 0.001;

    const created = await prisma.refundCase.create({
      data: {
        caseNumber,
        countryId: d.countryId,
        brandId: d.brandId,
        customerName: d.customerName,
        customerEmail: d.customerEmail,
        customerPhone: d.customerPhone,
        orderNumber: d.orderNumber,
        orderDate: new Date(Date.now() - (i + 1) * 86_400_000),
        orderAmount: d.orderAmount,
        orderCurrency: d.orderCurrency,
        totalRefundAmount: totalRefund,
        isPartial,
        status: d.status as never,
        rootCauseId: rootCause?.id ?? null,
        createdById: admin.id,
        approvedById: ['APPROVED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(d.status) ? admin.id : null,
        approvedAt: ['APPROVED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(d.status) ? new Date() : null,
        components: {
          create: d.components.map((c) => ({
            paymentMethodId: c.paymentMethodId,
            amount: c.amount,
            currency: d.orderCurrency,
            authCode: c.authCode ?? null,
            last4: c.last4 ?? null,
            status: d.status === 'REFUNDED' ? 'REFUNDED' : d.status === 'PARTIALLY_REFUNDED' ? 'AWAITING_BATCH' : 'PENDING',
          })),
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        caseId: created.id,
        actorId: admin.id,
        actorLabel: admin.name,
        kind: 'case.created',
        message: `Case ${caseNumber} created`,
      },
    });

    if (d.notes) {
      for (const body of d.notes) {
        await prisma.caseNote.create({
          data: { caseId: created.id, authorId: admin.id, body },
        });
      }
    }
  }

  console.log(`→ Seeded ${demos.length} demo cases.`);

  // Add a couple of unread notifications for the admin
  await prisma.notification.create({
    data: {
      userId: admin.id,
      type: 'CASE_ASSIGNED',
      title: 'Welcome — review your refund cases',
      body: 'Demo data has been seeded. Open the Cases page to explore.',
      href: '/cases',
    },
  });
}

async function seedFeatureFlags() {
  const flags = [
    { key: 'feature.promo.compensation', enabled: true, description: 'Enable customer compensation promos' },
    { key: 'feature.promo.service_recovery', enabled: true, description: 'Enable service recovery promos' },
    { key: 'feature.fraud_signals', enabled: true, description: 'Enable fraud detection signals' },
    { key: 'feature.scheduled_reports', enabled: true, description: 'Enable scheduled email reports' },
    { key: 'feature.dark_mode', enabled: true, description: 'Allow users to switch to dark mode' },
    { key: 'feature.help_desk.stores_communication', enabled: true, description: 'Stores Communication module' },
  ];
  console.log(`→ Seeding ${flags.length} feature flags...`);
  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      create: f,
      update: { description: f.description },
    });
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  WOW Refund v2 — Seeding database');
  console.log('═══════════════════════════════════════════\n');

  await seedCurrencies();
  await seedCountryRegistry();
  await seedPaymentMethods();
  await seedRootCauses();
  await seedPermissionsAndRoles();
  await seedEmailTemplates();
  await seedStoreMessageTemplates();
  await seedActiveCountries();
  await seedDefaultBrands();
  await seedDefaultAdmin();
  await seedFeatureFlags();
  await seedDemoCases();

  console.log('\n✓ Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
