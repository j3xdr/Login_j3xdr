/* CKR Admin — Login_j3xdr (token system via Render API) */
(function () {
  "use strict";

  const cfg = window.PARTYRUN_CONFIG;
  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    document.body.innerHTML = "<p style='color:#f88;padding:2rem'>Missing config.js</p>";
    return;
  }

  const API = cfg.API_BASE || "";
  const { createClient } = supabase;
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);
  const loginPanel = $("login-panel");
  const dash = $("dash");

  let accessToken = null;

  function setStatus(el, text, kind) {
    el.textContent = text || "";
    el.className = "status " + (kind || "muted");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(path, options = {}) {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {}
    );
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    const res = await fetch(API + path, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (!res.ok) {
      const detail = data?.detail || data?.reason || res.statusText;
      const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function requireAdminSession() {
    const { data: sess } = await sb.auth.getSession();
    if (!sess?.session) return null;
    accessToken = sess.session.access_token;
    try {
      const me = await api("/api/me");
      if (me?.profile?.role !== "admin") {
        await sb.auth.signOut();
        accessToken = null;
        return null;
      }
      return { session: sess.session, profile: me.profile };
    } catch (_) {
      await sb.auth.signOut();
      accessToken = null;
      return null;
    }
  }

  async function showDash(profile) {
    loginPanel.classList.add("hidden");
    dash.classList.remove("hidden");
    $("who-user").textContent = profile.username || profile.display_name || "admin";
    await loadUsers();
  }

  function showLogin() {
    dash.classList.add("hidden");
    loginPanel.classList.remove("hidden");
  }

  async function loadUsers() {
    const listStatus = $("list-status");
    const tbody = $("users-body");
    tbody.innerHTML = "<tr><td colspan='3' style='color:var(--muted)'>กำลังโหลด…</td></tr>";
    try {
      const data = await api("/api/admin/users");
      const users = data.users || [];
      if (!users.length) {
        tbody.innerHTML = "<tr><td colspan='3' style='color:var(--muted)'>ยังไม่มีผู้ใช้</td></tr>";
        return;
      }
      tbody.innerHTML = users
        .map(
          (u) =>
            "<tr><td>" +
            escapeHtml(u.username || "—") +
            '</td><td><span class="role ' +
            escapeHtml(u.role) +
            '">' +
            escapeHtml(u.role) +
            "</span></td><td>" +
            escapeHtml(u.token_balance ?? 0) +
            "</td></tr>"
        )
        .join("");
      setStatus(listStatus, "", "muted");
    } catch (e) {
      tbody.innerHTML = "";
      setStatus(listStatus, e.message, "err");
    }
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("login-user").value.trim();
    const password = $("login-pass").value;
    $("login-btn").disabled = true;
    setStatus($("login-status"), "กำลังเข้าสู่ระบบ…", "muted");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: { username, password },
      });
      if (!data.access_token || !data.refresh_token) {
        throw new Error("login_no_session");
      }
      if (data.profile?.role !== "admin") {
        throw new Error("บัญชีนี้ไม่ใช่ Admin");
      }
      const { error } = await sb.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (error) throw error;
      accessToken = data.access_token;
      setStatus($("login-status"), "", "muted");
      await showDash(data.profile);
    } catch (err) {
      setStatus($("login-status"), err.message || String(err), "err");
      showLogin();
    } finally {
      $("login-btn").disabled = false;
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    await sb.auth.signOut();
    accessToken = null;
    showLogin();
    setStatus($("login-status"), "ออกจากระบบแล้ว", "muted");
  });

  $("refresh-btn").addEventListener("click", () => loadUsers());

  $("create-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("create-btn").disabled = true;
    setStatus($("create-status"), "กำลังสร้าง…", "muted");
    try {
      const data = await api("/api/admin/create-user", {
        method: "POST",
        body: {
          username: $("create-user").value.trim(),
          password: $("create-pass").value,
          initial_tokens: Number($("create-tokens").value) || 0,
        },
      });
      setStatus(
        $("create-status"),
        "สร้างแล้ว: " + data.username + " · " + data.token_balance + " tokens",
        "ok"
      );
      $("create-form").reset();
      $("create-tokens").value = "0";
      await loadUsers();
    } catch (err) {
      setStatus($("create-status"), err.message || String(err), "err");
    } finally {
      $("create-btn").disabled = false;
    }
  });

  $("lookup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("lookup-q").value.trim();
    $("lookup-result").textContent = "Looking up…";
    try {
      const data = await api("/api/admin/lookup?q=" + encodeURIComponent(q));
      if (!data.ok) {
        $("lookup-result").textContent = data.reason || "not found";
        return;
      }
      $("lookup-result").innerHTML =
        "<strong>" +
        escapeHtml(data.username || q) +
        "</strong> · tokens: " +
        escapeHtml(data.token_balance) +
        " · role: " +
        escapeHtml(data.role);
      $("credit-q").value = data.username || q;
    } catch (err) {
      $("lookup-result").textContent = err.message;
    }
  });

  $("credit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus($("credit-status"), "Crediting…", "muted");
    try {
      const data = await api("/api/admin/add-tokens", {
        method: "POST",
        body: {
          query: $("credit-q").value.trim(),
          amount: Number($("credit-amt").value) || 0,
          reason: "admin_credit",
        },
      });
      setStatus($("credit-status"), "New balance: " + data.token_balance, "ok");
      await loadUsers();
    } catch (err) {
      setStatus($("credit-status"), err.message, "err");
    }
  });

  (async () => {
    const ctx = await requireAdminSession();
    if (ctx) await showDash(ctx.profile);
  })();
})();
