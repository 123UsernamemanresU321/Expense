const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const inviteCode = process.env.NEXT_PUBLIC_INVITE_CODE;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEdgeFn() {
    // 1. Authenticate - create a new user dynamically to ensure valid credentials
    const email = `test.user.${Date.now()}@example.com`;
    console.log("Creating test user:", email);

    // We can't easily sign up because of invite code / metadata, let's try calling edge function
    // as an anonymous client to see what happens, or skip auth and rely on anon key

    // Call the edge function using native fetch to see the RAW response body
    // (supabase.functions.invoke hides the body on 4xx errors!)
    const url = `${supabaseUrl}/functions/v1/aggregate-monthly-summaries`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": supabaseKey
        },
        body: JSON.stringify({
            ledger_id: "00000000-0000-0000-0000-000000000000",
            month: "2023-01"
        })
    });

    console.log("Status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Response Body:", text);
}

testEdgeFn();
