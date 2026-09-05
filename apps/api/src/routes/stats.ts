import { Hono } from 'hono'
import { prisma } from '../index.js'

export const statsRouter = new Hono()

statsRouter.get('/', async c => {
  const [totalContacts, activeDeals, wonDeals, recentActivities, contactsByStatus, dealsByStage] =
    await Promise.all([
      prisma.contact.count(),
      prisma.deal.count({ where: { NOT: { stage: { in: ['won', 'lost'] } } } }),
      prisma.deal.count({ where: { stage: 'won' } }),
      prisma.activity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { contact: { select: { name: true } } },
      }),
      prisma.contact.groupBy({ by: ['status'], _count: true }),
      prisma.deal.groupBy({
        by: ['stage'],
        _sum: { amount: true },
        where: { NOT: { stage: { in: ['lost'] } } },
      }),
    ])

  const pipelineAgg = await prisma.deal.aggregate({
    _sum: { amount: true },
  })

  return c.json({
    totalContacts,
    activeDeals,
    pipelineValue: pipelineAgg._sum.amount ?? 0,
    wonDeals,
    recentActivities: recentActivities.map(a => ({
      id: a.id,
      contactId: a.contactId,
      contactName: a.contact.name,
      type: a.type,
      subject: a.subject,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
    })),
    contactsByStage: contactsByStatus.map(s => ({ stage: s.status, count: s._count })),
    dealsByStage: dealsByStage.map(d => ({ stage: d.stage, value: d._sum.amount ?? 0 })),
  })
})