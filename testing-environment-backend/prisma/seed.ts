import { PrismaClient, SubscriptionPlanName } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    name: SubscriptionPlanName.FREE,
    maxProjects: 2,
    maxRunsPerMonth: 50,
    maxConcurrentRuns: 1,
    maxRunnerMinutes: 100,
    reportRetentionDays: 7,
  },
  {
    name: SubscriptionPlanName.PRO,
    maxProjects: 10,
    maxRunsPerMonth: 500,
    maxConcurrentRuns: 3,
    maxRunnerMinutes: 1500,
    reportRetentionDays: 30,
  },
  {
    name: SubscriptionPlanName.BUSINESS,
    maxProjects: 50,
    maxRunsPerMonth: 5000,
    maxConcurrentRuns: 10,
    maxRunnerMinutes: 15000,
    reportRetentionDays: 90,
  },
  {
    name: SubscriptionPlanName.ENTERPRISE,
    maxProjects: 500,
    maxRunsPerMonth: 100000,
    maxConcurrentRuns: 50,
    maxRunnerMinutes: 500000,
    reportRetentionDays: 365,
  },
];

async function main(): Promise<void> {
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      create: plan,
      update: plan,
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
