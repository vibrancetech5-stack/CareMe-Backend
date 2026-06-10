import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required. Add it to D:\\CareMe\\.env');
}
if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required. Add it to D:\\CareMe\\.env');
}
if (supabaseUrl.includes('YOUR_PROJECT') || supabaseServiceKey.includes('YOUR_SERVICE_ROLE_KEY')) {
    throw new Error('Supabase env vars are placeholders. Set real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in D:\\CareMe\\.env');
}
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
