const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testDelete() {
    // 1. Authenticate as the seed user
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'alice@example.com',
        password: 'password123'
    });

    if (authErr) {
        console.error("Auth Error:", authErr);
        return;
    }

    // 2. Fetch a transaction to delete
    const { data: txns } = await supabase.from('transactions').select('id, description').limit(1);

    if (!txns || txns.length === 0) {
        console.log("No transactions to delete");
        return;
    }

    const txnId = txns[0].id;
    console.log("Attempting to delete transaction:", txnId, txns[0].description);

    // 3. Try deleting with select().single()
    const { data, error } = await supabase.from('transactions')
        .delete()
        .eq('id', txnId)
        .select()
        .single();

    if (error) {
        console.error("\n[DELETE FAILED]", error.code, error.message, error.details);

        // Let's debug RLS manually
        const { data: hasAccess } = await supabase.rpc('has_write_access', { p_ledger_id: "replace" });
        console.log("Custom RPC check to see if we have write access might show true/false based on RLS.");
    } else {
        console.log("\n[DELETE SUCCESS]", data);
    }
}

testDelete();
