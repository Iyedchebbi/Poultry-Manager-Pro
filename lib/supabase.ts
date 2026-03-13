import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kvillpzgwsnynvjprjcz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2aWxscHpnd3NueW52anByamN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTY0MjMsImV4cCI6MjA4ODk5MjQyM30.k1_zeJBQ3JnPfA-Izkj_mQ856NBnEVek5FAOIwTPKug';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
