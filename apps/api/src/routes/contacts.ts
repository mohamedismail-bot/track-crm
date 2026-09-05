import { Hono } from 'hono'
import { z } from 'zod'
import { prisma } from '../index.js'
import { CONTACT_STATUSES } from '@track-crm/shared'

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  status: z.enum(CONTACT_STATUSES).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
})

const patchSchema = contactSchema.partial()

function serialize(c: {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  title: string | null
  status: string
  tags: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...c,
    tags: JSON.parse(c.tags) as string[],
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

export const contactsRouter = new Hono()

contactsRouter.get('/', async c => {
  const { status, q } = c.req.query()
  const contacts = await prisma.contact.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { company: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
  })
  return c.json(contacts.map(serialize))
})

contactsRouter.get('/:id', async c => {
  const contact = await prisma.contact.findUnique({ where: { id: c.req.param('id') } })
  if (!contact) return c.json({ error: 'Contact not found' }, 404)
  return c.json(serialize(contact))
})

contactsRouter.post('/', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

  const contact = await prisma.contact.create({
    data: { ...parsed.data, tags: JSON.stringify(parsed.data.tags ?? []) },
  })
  return c.json(serialize(contact), 201)
})

contactsRouter.patch('/:id', async c => {
  const body = await c.req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

  const { tags, ...rest } = parsed.data
  const contact = await prisma.contact
    .update({
      where: { id: c.req.param('id') },
      data: {
        ...rest,
        ...(tags ? { tags: JSON.stringify(tags) } : {}),
      },
    })
    .catch(() => null)

  if (!contact) return c.json({ error: 'Contact not found' }, 404)
  return c.json(serialize(contact))
})

contactsRouter.delete('/:id', async c => {
  await prisma.contact.delete({ where: { id: c.req.param('id') } }).catch(() => null)
  return c.body(null, 204)
})