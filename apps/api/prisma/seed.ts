import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const contacts = [
  { name: 'Alice Johnson', email: 'alice@acme.com', phone: '+1-555-0101', company: 'Acme Inc', title: 'CTO', status: 'customer', tags: ['enterprise', 'priority'], notes: 'Renewal in Q3' },
  { name: 'Bob Smith', email: 'bob@globex.com', phone: '+1-555-0102', company: 'Globex', title: 'VP Eng', status: 'prospect', tags: ['enterprise'], notes: 'Evaluating platform' },
  { name: 'Carol White', email: 'carol@initech.com', phone: '+1-555-0103', company: 'Initech', title: 'Product Manager', status: 'lead', tags: ['sme'], notes: 'Downloaded whitepaper' },
  { name: 'David Lee', email: 'david@umbr.core', phone: '+1-555-0104', company: 'Umbra Core', title: 'Founder', status: 'customer', tags: ['startup'], notes: '' },
  { name: 'Emma Brown', email: 'emma@hooli.com', phone: '+1-555-0105', company: 'Hooli', title: 'Director of Sales', status: 'inactive', tags: [], notes: 'Paused for budget cycle' },
] as const

const now = new Date()

async function main() {
  await prisma.contact.deleteMany()
  await prisma.deal.deleteMany()
  await prisma.activity.deleteMany()

  for (const c of contacts) {
    await prisma.contact.create({
      data: {
        ...c,
        status: c.status as never,
        tags: JSON.stringify(c.tags),
      },
    })
  }

  const [alice, bob, carol] = await prisma.contact.findMany({ take: 3 })

  await prisma.deal.createMany({
    data: [
      { name: 'Acme Platform Expansion', contactId: alice?.id!, amount: 50000, stage: 'negotiation', expectedCloseDate: new Date(now.getTime() + 30 * 86400000) },
      { name: 'Globex Enterprise Trial', contactId: bob?.id!, amount: 25000, stage: 'qualified', expectedCloseDate: new Date(now.getTime() + 60 * 86400000) },
      { name: 'Initech Starter', contactId: carol?.id!, amount: 5000, stage: 'lead', expectedCloseDate: null },
      { name: 'Acme Renewal', contactId: alice?.id!, amount: 40000, stage: 'won', expectedCloseDate: new Date(now.getTime() - 5 * 86400000) },
    ],
  })

  await prisma.activity.createMany({
    data: [
      { contactId: alice?.id!, type: 'meeting', subject: 'Q3 roadmap review', description: 'Discussed expansion needs' },
      { contactId: bob?.id!, type: 'call', subject: 'Intro call', description: 'Product demo scheduled' },
      { contactId: carol?.id!, type: 'email', subject: 'Sent pricing sheet', description: null },
      { contactId: alice?.id!, type: 'task', subject: 'Prepare renewal contract', description: 'Legal review needed' },
    ],
  })

  console.log('Seeded database')
}

main().finally(() => prisma.$disconnect())