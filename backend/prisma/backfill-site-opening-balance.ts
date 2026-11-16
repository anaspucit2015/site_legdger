import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// One-time backfill, SITES ONLY: openingBalance = currentBalance, limited to sites
// where openingBalance is still 0 (the untouched migration default). Never overwrites
// a site that already has a real, non-zero opening balance set.
//
// Dry run by default -- prints what WOULD change, writes nothing.
// Pass --apply to actually write the changes.
//
// Usage:
//   npx ts-node prisma/backfill-site-opening-balance.ts            (dry run)
//   npx ts-node prisma/backfill-site-opening-balance.ts --apply    (writes)
async function main() {
  const apply = process.argv.includes('--apply');

  const sites = await prisma.site.findMany({
    where: { openingBalance: 0 },
    select: { id: true, name: true, siteCode: true, openingBalance: true, currentBalance: true },
    orderBy: { name: 'asc' },
  });

  if (sites.length === 0) {
    console.log('No sites with openingBalance = 0. Nothing to do.');
    return;
  }

  console.log(`${apply ? 'APPLYING' : 'DRY RUN'} -- ${sites.length} site(s) with openingBalance = 0:\n`);

  for (const site of sites) {
    const before = Number(site.openingBalance);
    const after = Number(site.currentBalance);
    const code = `S-${String(site.siteCode).padStart(3, '0')}`;
    console.log(`${code}  ${site.name.padEnd(24)}  openingBalance: ${before}  ->  ${after}`);

    if (apply) {
      await prisma.site.update({
        where: { id: site.id },
        data: { openingBalance: site.currentBalance },
      });
    }
  }

  console.log(
    apply
      ? `\nUpdated ${sites.length} site(s).`
      : `\nDry run only -- no changes written. Re-run with --apply to write.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
