import { createClient } from '@supabase/supabase-js'

// Cliente único de Supabase para toda la app.
// (Extraído de App.jsx durante el refactor — mismo comportamiento, un solo origen.)
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)
