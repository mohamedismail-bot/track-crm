import { serve } from '@hono/node-server'
import app from './index.js'

const port = Number(process.env.PORT) || 4000

const server = serve({ fetch: app.fetch, port })

server.addListener('listening', () => {
  console.log(`API listening on http://localhost:${port}`)
})

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())