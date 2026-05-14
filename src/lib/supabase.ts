import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xwsprdllfxlkwousmjan.supabase.co';
const supabaseAnonKey = 'sb_publishable_oBcw116rYrPAFm4GvT34bg_HHVeLb9r';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
