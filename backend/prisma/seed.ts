import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@siteledger.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@siteledger.com',
      password,
      role: 'admin',
    },
  });

  console.log('Seeded admin:', admin.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
