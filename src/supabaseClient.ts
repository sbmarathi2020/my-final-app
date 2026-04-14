import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ntvlibxqmwjvjhsnshzf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50dmxpYnhxbXdqdmpoc25zaHpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0Njg2MzQsImV4cCI6MjA5MTA0NDYzNH0.71DRKHhWOW2fSk3vHKjER44zwyqsin2ADReTpe_0XTE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});