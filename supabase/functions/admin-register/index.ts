// Admin-only customer registration for PartyRun rental accounts.
// Uses service role to create Auth users. Never expose service_role to the browser.
// verify_jwt=true — caller must send Authorization: Bearer <admin access_token>

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ ok: false, error: "server_misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ ok: false, error: "missing_authorization" }, 401);
  }

  // Validate caller JWT as the admin user
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) {
    return json({ ok: false, error: "invalid_token" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileErr } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile || profile.role !== "admin") {
    return json({ ok: false, error: "admin_only" }, 403);
  }

  let body: {
    email?: string;
    password?: string;
    hours?: number;
    minutes?: number;
    seconds?: number;
    permanent?: boolean;
    role?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const permanent = Boolean(body.permanent);
  const hours = Math.max(0, Number(body.hours) || 0);
  const minutes = Math.max(0, Number(body.minutes) || 0);
  const seconds = Math.max(0, Number(body.seconds) || 0);
  const role = body.role === "admin" ? "admin" : "normal";

  if (!email || !email.includes("@")) {
    return json({ ok: false, error: "invalid_email" }, 400);
  }
  if (password.length < 6) {
    return json({ ok: false, error: "password_too_short" }, 400);
  }
  if (!permanent && hours === 0 && minutes === 0 && seconds === 0) {
    return json({ ok: false, error: "rental_duration_required" }, 400);
  }

  const { data: created, error: createErr } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createErr || !created?.user) {
    return json(
      {
        ok: false,
        error: "create_user_failed",
        detail: createErr?.message ?? "unknown",
      },
      400,
    );
  }

  const userId = created.user.id;
  let expiresAt: string | null = null;
  if (!permanent) {
    const ms =
      ((hours * 3600) + (minutes * 60) + seconds) * 1000;
    expiresAt = new Date(Date.now() + ms).toISOString();
  }

  const { error: updErr } = await adminClient
    .from("profiles")
    .update({
      role,
      is_permanent: permanent,
      expires_at: expiresAt,
      email,
    })
    .eq("id", userId);

  if (updErr) {
    // Roll back auth user if profile patch fails
    await adminClient.auth.admin.deleteUser(userId);
    return json(
      { ok: false, error: "profile_update_failed", detail: updErr.message },
      500,
    );
  }

  return json({
    ok: true,
    user: {
      id: userId,
      email,
      role,
      is_permanent: permanent,
      expires_at: expiresAt,
    },
  });
});
