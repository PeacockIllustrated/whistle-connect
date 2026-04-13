import { config } from 'dotenv'

// Load .env.local for test environment
config({ path: '.env.local' })

/** True when SUPABASE_SERVICE_ROLE_KEY is available for integration tests. */
export const HAS_DB = !!process.env.SUPABASE_SERVICE_ROLE_KEY
