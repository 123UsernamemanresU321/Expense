export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-cron-secret, x-user-jwt",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function corsResponse() {
    return new Response("ok", { headers: corsHeaders });
}
