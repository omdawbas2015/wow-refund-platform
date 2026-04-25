import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const countries = await prisma.country.findMany({ select: { id: true, name: true } });
  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const rootCauses = await prisma.rootCause.findMany({ select: { id: true, name: true } });

  console.log('Users:', users);
  console.log('Countries count:', countries.length);
  console.log('Branches count:', branches.length);
  console.log('RootCauses count:', rootCauses.length);
}

check();
