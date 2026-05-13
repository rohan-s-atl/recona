import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (!url || !key) return null
  if (!_client) _client = createClient(url, key)
  return _client
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url && key)
}
