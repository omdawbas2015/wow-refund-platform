import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function test() {
  const email = 'admin@alshaya.com';
  const password = 'password123';
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found');
    return;
  }
  
  const match = await bcrypt.compare(password, user.password);
  console.log(`Password match for ${email}: ${match}`);
}

test().catch(console.error).finally(() => prisma.$disconnect());
