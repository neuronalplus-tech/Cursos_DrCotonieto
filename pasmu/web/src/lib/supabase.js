import { createClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY

function normalizeSupabaseUrl(value) {
  if (!value) return null

  const url = new URL(value)
  url.pathname = url.pathname.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
  return url.toString().replace(/\/$/, '')
}

const supabaseUrl = normalizeSupabaseUrl(configuredUrl)

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey)
}

export async function checkSupabaseConnection() {
  if (!supabase) return { configured: false, connected: false }

  const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
    headers: { apikey: supabaseKey }
  })

  if (!response.ok) {
    throw new Error(`Supabase respondió con HTTP ${response.status}.`)
  }

  return { configured: true, connected: true }
}

if (Boolean(configuredUrl) !== Boolean(supabaseKey)) {
  throw new Error('Configura VITE_SUPABASE_URL y una clave publishable/anon para conectar Supabase.')
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null
