const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'
    });
    
    if (signInError) {
        console.log("SignIn Error:", signInError.message);
        return;
    }

    const res = await supabase.functions.invoke('reconcile-snapshot-helper', {
        body: { ledger_id: 'dummy', account_id: 'dummy', snapshot_date: '2026-02-28', statement_balance: 0 }
    });
    console.log("EF Response:", res);
}
test();
