const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const inviteCode = process.env.NEXT_PUBLIC_INVITE_CODE;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEdgeFn() {
    const email = `testuser${Date.now()}@gmail.com`;
    console.log("Signing up...", email);
    const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password: 'password123',
        options: {
            data: {
                first_name: "Test",
                last_name: "User",
                invite_code: inviteCode
            }
        }
    });

    if (authErr && !authData?.session) {
        console.error("Auth Error:", authErr);
        // Maybe sign up requires email confirmation?
        // Let's try to just invoke the function without ledger id to see if it even reaches the function logic
        // If it throws 401, it's before function execution. If it throws 400 (missing ledger), it parsed auth!
    } else {
        console.log("Logged in. Checking token:");
    }

    // We can manually fetch passing the JWT in Authorization header:
    const token = authData?.session?.access_token || "random_invalid_token";
    console.log("Token starts with:", token.substring(0, 15));

    console.log("Invoking edge function via node fetch...");
    const res = await fetch(`${supabaseUrl}/functions/v1/aggregate-monthly-summaries`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "apikey": supabaseKey
        },
        body: JSON.stringify({ ledger_id: "00000000-0000-0000-0000-000000000000", month: "2023-01" })
    });

    console.log("HTTP Status:", res.status, res.statusText);
    const text = await res.text();
    console.log("Response Body:", text);
}

testEdgeFn();
