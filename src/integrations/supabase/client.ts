 import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Direct-ah keys add panniyachu (Blank screen fix panrathukaaga)
const SUPABASE_URL = "https://qkemdnjlzzggcknfjpol.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrZW1kbmpsenpnZ2NrbmZqcG9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQxOTIsImV4cCI6MjA5MDQ1MDE5Mn0.iu1ta6kzrRhsNdvyTntXOa2UiNEtQFMkiNkL6XoaX1U";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});