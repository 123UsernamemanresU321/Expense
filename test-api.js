const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    const { data, error } = await supabase.from('transactions').select('*, category:categories(name), merchant:merchants(name), account:accounts(name)').limit(5);
    console.log("Error:", error);
}
test();
