import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

import { contactsRouter } from './routes/contacts.js'
import { dealsRouter } from './routes/deals.js'
import { activitiesRouter } from './routes/activities.js'
import { statsRouter } from './routes/stats.js'

const app = new Hono()

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

app.get('/health', c => c.json({ ok: true }))
app.route('/api/contacts', contactsRouter)
app.route('/api/deals', dealsRouter)
app.route('/api/activities', activitiesRouter)
app.route('/api/stats', statsRouter)

export default app