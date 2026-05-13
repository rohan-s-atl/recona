import path from 'path'
import { config } from 'dotenv'

// npm workspace scripts run with backend/ as cwd, while shared queue secrets live
// in the repo-root .env. Load both, with backend/.env allowed to override locally.
config({ path: path.resolve(process.cwd(), '..', '.env') })
config({ path: path.resolve(process.cwd(), '.env'), override: true })
