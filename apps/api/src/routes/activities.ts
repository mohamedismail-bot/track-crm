import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../index.js'
import { ACTIVITY_TYPES } from '@parishia-smart/shared'

const activitySchema = z.object({
  contactId: z.string().min(1),
  type: z.enum(ACTIVITY_TYPES),
  subject: z.string().min(1),
  description: z.string().nullable().optional(),
})

function serialize(a: {
  id: string
  contactId: string
  type: string
  subject: string
  description: string | null
  createdAt: Date
}) {
  return { ...a, createdAt: a.createdAt.toISOString() }
}

export const activitiesRouter = new Hono()

activitiesRouter.get('/', async c => {
  const { contactId, limit } = c.req.query()
  const activities = await prisma.activity.findMany({
    where: contactId ? { contactId } : {},
    orderBy: { createdAt: 'desc' },
    take: limit ? Math.min(Number(limit), 100) : 50,
    include: { contact: { select: { name: true } } },
  })
  return c.json(
    activities.map(({ contact, ...rest }) => ({
      ...serialize(rest as never),
      contactName: contact.name,
    })),
  )
})

activitiesRouter.post('/', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = activitySchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

  const existing = await prisma.contact.findUnique({
    where: { id: parsed.data.contactId },
  })
  if (!existing) return c.json({ error: 'Contact not found' }, 404)

  const activity = await prisma.activity.create({ data: parsed.data })
  return c.json(serialize(activity), 201)
})

activitiesRouter.delete('/:id', async c => {
  await prisma.activity.delete({ where: { id: c.req.param('id') } }).catch(() => null)
  return c.body(null, 204)
})