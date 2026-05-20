import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://yynizaxolzedvkhvrmse.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_vtO-pX2gKaTDFiZ7VlMjSg_IkG4zQ8w';

export const supabase = createClient(supabaseUrl, supabaseKey);
