// Admin day-rental: create / extend / revoke / make_permanent (PC or Powder).
// Uses service role for Auth + profiles. Never expose service_role to the browser.
// verify_jwt=true — caller must send Authorization: Bearer <admin access_token>
//
// Body:
//   action?: "create" | "extend" | "revoke" | "make_permanent" | "clear_permanent" | "set_expires"  (default create)
//   product?: "pc" | "powder"  (default pc; legacy "pc_powder" → powder)
//   username?: string   (preferred for WWDC)
//   email?: string      (legacy; or derived from username)
//   password?: string   (create only)
//   days?, hours?, minutes?, seconds?, permanent?

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYNTHETIC_EMAIL_DOMAIN = "users.ckr.local";

type Action =
  | "create"
  | "extend"
  | "revoke"
  | "make_permanent"
  | "clear_permanent"
  | "set_expires";

type Product = "pc" | "powder";

type Body = {
  action?: string;
  product?: string;
  email?: string;
  username?: string;
  password?: string;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  permanent?: boolean;
  role?: string;
  expires_at?: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  is_permanent: boolean;
  expires_at: string | null;
  powder_is_permanent: boolean;
  powder_expires_at: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 64);
}

function syntheticEmail(username: string): string {
  const sanitized = sanitizeUsername(username);
  return `${sanitized}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

function parseProduct(raw: string | undefined): Product {
  const p = String(raw || "pc").trim().toLowerCase();
  if (p === "powder" || p === "pc_powder") return "powder";
  return "pc";
}

function parseDuration(body: Body) {
  const days = Math.max(0, Math.floor(Number(body.days) || 0));
  const hours = Math.max(0, Math.floor(Number(body.hours) || 0));
  const minutes = Math.max(0, Math.floor(Number(body.minutes) || 0));
  const seconds = Math.max(0, Math.floor(Number(body.seconds) || 0));
  return { days, hours, minutes, seconds };
}

function durationMs(d: {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}): number {
  return (
    ((d.days * 86400) + (d.hours * 3600) + (d.minutes * 60) + d.seconds) *
    1000
  );
}

function hasDuration(d: {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}): boolean {
  return d.days > 0 || d.hours > 0 || d.minutes > 0 || d.seconds > 0;
}

function parseAction(raw: string | undefined): Action {
  const a = String(raw || "create").trim().toLowerCase();
  if (a === "extend" || a === "renew") return "extend";
  if (a === "revoke" || a === "expire") return "revoke";
  if (a === "make_permanent" || a === "permanent") return "make_permanent";
  if (a === "clear_permanent" || a === "unset_permanent") return "clear_permanent";
  if (a === "set_expires" || a === "set_expire") return "set_expires";
  return "create";
}

function profileSelectFields() {
  return "id, username, is_permanent, expires_at, powder_is_permanent, powder_expires_at";
}

function userPayload(row: ProfileRow, product: Product) {
  const base = {
    id: row.id,
    username: row.username,
    powder_is_permanent: row.powder_is_permanent,
    powder_expires_at: row.powder_expires_at ?? null,
  };
  if (product === "powder") {
    return {
      ...base,
      is_permanent: row.powder_is_permanent,
      expires_at: row.powder_expires_at ?? null,
    };
  }
  return {
    ...base,
    is_permanent: row.is_permanent,
    expires_at: row.expires_at ?? null,
  };
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

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const action = parseAction(body.action);
  const product = parseProduct(body.product);
  const usernameRaw = String(body.username || "").trim();
  const emailRaw = String(body.email || "").trim().toLowerCase();
  const permanent = Boolean(body.permanent);
  const duration = parseDuration(body);
  const role = body.role === "admin" ? "admin" : "normal";

  // ---------- EXTEND / REVOKE / MAKE_PERMANENT / SET_EXPIRES ----------
  if (action !== "create") {
    const query = usernameRaw || emailRaw;
    if (!query || query.length < 2) {
      return json({ ok: false, error: "username_required" }, 400);
    }

    if (action === "set_expires") {
      const expiresRaw = String(body.expires_at || "").trim();
      if (!expiresRaw) {
        return json({ ok: false, error: "expires_at_required" }, 400);
      }
      const exp = new Date(expiresRaw);
      if (Number.isNaN(exp.getTime())) {
        return json({ ok: false, error: "invalid_expires_at" }, 400);
      }
      if (exp.getTime() <= Date.now()) {
        return json({ ok: false, error: "expires_must_be_future" }, 400);
      }

      const { data: looked, error: lookErr } = await adminClient.rpc(
        "admin_lookup_user",
        { p_query: query },
      );
      const lookup = looked as Record<string, unknown> | null;
      if (lookErr || !lookup || lookup.ok !== true) {
        return json({ ok: false, error: "user_not_found" }, 404);
      }

      const patch =
        product === "powder"
          ? { powder_is_permanent: false, powder_expires_at: exp.toISOString() }
          : { is_permanent: false, expires_at: exp.toISOString() };

      const { data: updated, error: updErr } = await adminClient
        .from("profiles")
        .update(patch)
        .eq("id", lookup.id)
        .select(profileSelectFields())
        .single();

      if (updErr || !updated) {
        return json(
          { ok: false, error: "set_expires_failed", detail: updErr?.message },
          500,
        );
      }

      return json({
        ok: true,
        action: "set_expires",
        product,
        user: userPayload(updated as ProfileRow, product),
      });
    }

    if (action === "clear_permanent") {
      const { data: looked, error: lookErr } = await adminClient.rpc(
        "admin_lookup_user",
        { p_query: query },
      );
      const lookup = looked as Record<string, unknown> | null;
      if (lookErr || !lookup || lookup.ok !== true) {
        return json({ ok: false, error: "user_not_found" }, 404);
      }

      const patch =
        product === "powder"
          ? { powder_is_permanent: false }
          : { is_permanent: false };

      const { data: updated, error: updErr } = await adminClient
        .from("profiles")
        .update(patch)
        .eq("id", lookup.id)
        .select(profileSelectFields())
        .single();

      if (updErr || !updated) {
        return json(
          { ok: false, error: "clear_permanent_failed", detail: updErr?.message },
          500,
        );
      }

      return json({
        ok: true,
        action: "clear_permanent",
        product,
        user: userPayload(updated as ProfileRow, product),
      });
    }

    const { data: rpcData, error: rpcErr } = await adminClient.rpc(
      "admin_extend_rental_product",
      {
        p_username: query,
        p_product: product,
        p_days: duration.days,
        p_hours: duration.hours,
        p_minutes: duration.minutes,
        p_seconds: duration.seconds,
        p_permanent: action === "make_permanent" || permanent,
        p_revoke: action === "revoke",
      },
    );

    if (rpcErr) {
      return json(
        { ok: false, error: "extend_failed", detail: rpcErr.message },
        500,
      );
    }

    const result = rpcData as Record<string, unknown> | null;
    if (!result || result.ok !== true) {
      const reason = String(result?.reason || "extend_failed");
      const status = reason === "user_not_found" ? 404 : 400;
      return json({ ok: false, error: reason }, status);
    }

    const row: ProfileRow = {
      id: String(result.id),
      username: (result.username as string | null) ?? null,
      is_permanent: Boolean(result.is_permanent),
      expires_at: (result.expires_at as string | null) ?? null,
      powder_is_permanent: Boolean(result.powder_is_permanent),
      powder_expires_at: (result.powder_expires_at as string | null) ?? null,
    };

    return json({
      ok: true,
      action: result.action || action,
      product,
      user: userPayload(row, product),
    });
  }

  // ---------- CREATE ----------
  const username = usernameRaw;
  let email = emailRaw;

  if (username) {
    if (username.length < 2) {
      return json({ ok: false, error: "username_too_short" }, 400);
    }
    if (!/^[a-zA-Z0-9._-]{2,64}$/.test(username)) {
      return json({ ok: false, error: "invalid_username" }, 400);
    }
    email = syntheticEmail(username);
  }

  if (!email || !email.includes("@")) {
    return json({ ok: false, error: "invalid_email_or_username" }, 400);
  }

  const password = String(body.password || "");
  if (password.length < 6) {
    return json({ ok: false, error: "password_too_short" }, 400);
  }
  if (!permanent && !hasDuration(duration)) {
    return json({ ok: false, error: "rental_duration_required" }, 400);
  }

  if (username) {
    const { data: existingLookup } = await adminClient.rpc("admin_lookup_user", {
      p_query: username,
    });
    if (existingLookup && (existingLookup as { ok?: boolean }).ok === true) {
      return json({ ok: false, error: "username_taken" }, 409);
    }
  }

  const { data: created, error: createErr } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: username
        ? { username, display_name: username }
        : undefined,
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
  let entitlementExpires: string | null = null;
  if (!permanent) {
    entitlementExpires = new Date(Date.now() + durationMs(duration)).toISOString();
  }

  const patch: Record<string, unknown> = {
    role,
    email,
  };
  if (username) {
    patch.username = username;
    patch.display_name = username;
  }

  if (product === "powder") {
    patch.is_permanent = false;
    patch.expires_at = null;
    patch.powder_is_permanent = permanent;
    patch.powder_expires_at = entitlementExpires;
  } else {
    patch.is_permanent = permanent;
    patch.expires_at = entitlementExpires;
    patch.powder_is_permanent = false;
    patch.powder_expires_at = null;
  }

  const { error: updErr } = await adminClient
    .from("profiles")
    .update(patch)
    .eq("id", userId);

  if (updErr) {
    await adminClient.auth.admin.deleteUser(userId);
    return json(
      { ok: false, error: "profile_update_failed", detail: updErr.message },
      500,
    );
  }

  const row: ProfileRow = {
    id: userId,
    username: username || null,
    is_permanent: product === "pc" ? permanent : false,
    expires_at: product === "pc" ? entitlementExpires : null,
    powder_is_permanent: product === "powder" ? permanent : false,
    powder_expires_at: product === "powder" ? entitlementExpires : null,
  };

  return json({
    ok: true,
    action: "create",
    product,
    user: {
      ...userPayload(row, product),
      email,
      role,
    },
  });
});
