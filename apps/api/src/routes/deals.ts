import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../index.js'
import { DEAL_STAGES } from '@parishia-smart/shared'

const dealSchema = z.object({
  name: z.string().min(1),
  contactId: z.string().min(1),
  amount: z.number().nonnegative(),
  stage: z.enum(DEAL_STAGES).optional(),
  expectedCloseDate: z.string().datetime().nullable().optional(),
})

const patchSchema = dealSchema.partial()

function serialize(d: {
  id: string
  name: string
  contactId: string
  amount: number
  stage: string
  expectedCloseDate: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...d,
    expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }
}

export const dealsRouter = new Hono()

dealsRouter.get('/', async c => {
  const { stage, contactId } = c.req.query()
  const deals = await prisma.deal.findMany({
    where: {
      ...(stage ? { stage: stage as never } : {}),
      ...(contactId ? { contactId } : {}),
    },
    include: { contact: { select: { name: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return c.json(
    deals.map(({ contact, ...rest }) => ({
      ...serialize(rest as never),
      contactName: contact.name,
    })),
  )
})

dealsRouter.get('/:id', async c => {
  const deal = await prisma.deal.findUnique({ where: { id: c.req.param('id') } })
  if (!deal) return c.json({ error: 'Deal not found' }, 404)
  return c.json(serialize(deal))
})

dealsRouter.post('/', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = dealSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

  const existing = await prisma.contact.findUnique({
    where: { id: parsed.data.contactId },
  })
  if (!existing) return c.json({ error: 'Contact not found' }, 404)

  const deal = await prisma.deal.create({
    data: {
      ...parsed.data,
      expectedCloseDate: parsed.data.expectedCloseDate
        ? new Date(parsed.data.expectedCloseDate)
        : null,
    },
  })
  return c.json(serialize(deal), 201)
})

dealsRouter.patch('/:id', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

  const deal = await prisma.deal
    .update({
      where: { id: c.req.param('id') },
      data: {
        ...parsed.data,
        ...(parsed.data.expectedCloseDate !== undefined
          ? {
              expectedCloseDate: parsed.data.expectedCloseDate
                ? new Date(parsed.data.expectedCloseDate)
                : null,
            }
          : {}),
      },
    })
    .catch(() => null)

  if (!deal) return c.json({ error: 'Deal not found' }, 404)
  return c.json(serialize(deal))
})

dealsRouter.delete('/:id', async c => {
  await prisma.deal.delete({ where: { id: c.req.param('id') } }).catch(() => null)
  return c.body(null, 204)
})