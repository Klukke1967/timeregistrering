import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvrpyjoidfybgqbuzuqc.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_9yeP6hdNL4Axtn-JyIYExA_-3rbikz5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  full_name: string;
  role: 'admin' | 'user';
  created_at?: string;
};

export type TimeEntry = {
  id?: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  hours: number;
  project_task: string;
  note?: string | null;
  created_at?: string;
  profiles?: {
    full_name: string;
    role: string;
  } | null;
};
