import './env'
import express from 'express'
import cors from 'cors'
import { uploadRouter } from './routes/upload'
import { reconcileRouter } from './routes/reconcile'
import { queueAvailable } from './queue'

const app = express()
const PORT = process.env.PORT ?? 4000

app.use(cors({ origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000' }))
app.use(express.json())

app.get('/health', (_req, res) =>
  res.json({
    status: 'ok',
    checks: {
      queue: queueAvailable ? 'configured' : 'not_configured',
      redis: process.env.REDIS_URL ? 'configured' : 'not_configured',
    },
  })
)
app.use('/api/upload', uploadRouter)
app.use('/api/reconcile', reconcileRouter)

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
