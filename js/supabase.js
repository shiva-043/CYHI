// One shared Supabase client for the whole static website.
// This is the public anon key. Never put a service-role key in frontend code.
const SUPABASE_URL = 'https://moytpatlnfzvmsazltvg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1veXRwYXRsbmZ6dm1zYXpsdHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxOTc5NzAsImV4cCI6MjEwNDc3Mzk3MH0.ttweN3G9ctXh0gJBa8ELFCT29NzNlO5HuzzikWeGg30'

if (!window.supabase?.createClient) {
  throw new Error('The Supabase library could not be loaded.')
}

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
