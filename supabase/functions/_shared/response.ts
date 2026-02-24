import { corsHeaders } from "./cors.ts";

export function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

export function errorResponse(message: string, status = 400) {
    return jsonResponse({ error: message }, status);
}

/**
 * Wraps an edge function handler with CORS preflight + error handling.
 */
export function handleRequest(
    handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
    return async (req: Request) => {
        if (req.method === "OPTIONS") {
            return new Response("ok", { headers: corsHeaders });
        }
        try {
            return await handler(req);
        } catch (err: unknown) {
            if (err && typeof err === "object" && "status" in err && "message" in err) {
                const e = err as { status: number; message: string };
                return errorResponse(e.message, e.status);
            }
            const message = err instanceof Error ? err.message : "Internal server error";
            console.error("Edge function error:", err);
            return errorResponse(message, 500);
        }
    };
}
