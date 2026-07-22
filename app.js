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
  let adminId = null;

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

  function initAccordions() {
    document.querySelectorAll("[data-accordion]").forEach((panel) => {
      const toggle = panel.querySelector(".accordion-toggle");
      if (!toggle || toggle.dataset.bound) return;
      toggle.dataset.bound = "1";
      toggle.addEventListener("click", () => {
        const open = panel.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
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

  function setChromeLoggedIn(on) {
    $("logout-btn").classList.toggle("hidden", !on);
    const chip = $("nav-admin");
    if (chip) chip.classList.toggle("hidden", !on);
  }

  async function showDash(profile) {
    loginPanel.classList.add("hidden");
    dash.classList.remove("hidden");
    setChromeLoggedIn(true);
    adminId = profile.id || null;
    $("who-user").textContent = profile.username || profile.display_name || "admin";
    initAccordions();
    await loadUsers();
  }

  function showLogin() {
    dash.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    setChromeLoggedIn(false);
    adminId = null;
  }

  function renderUsers(users) {
    const body = $("users-body");
    if (!users.length) {
      body.innerHTML = '<p class="muted user-items-empty">ยังไม่มีผู้ใช้</p>';
      return;
    }
    body.innerHTML = users
      .map((u) => {
        const id = escapeHtml(u.id || "");
        const name = escapeHtml(u.username || "—");
        const role = escapeHtml(u.role || "normal");
        const bal = Number(u.token_balance ?? 0);
        const isSelf = adminId && u.id === adminId;
        const isAdmin = role === "admin";
        const canDelete = !isSelf && !isAdmin;
        return (
          '<article class="user-item" data-user-id="' +
          id +
          '">' +
          '<div class="user-item-head">' +
          '<span class="user-name" title="' +
          name +
          '">' +
          name +
          "</span>" +
          '<span class="role ' +
          role +
          '">' +
          role +
          "</span>" +
          "</div>" +
          '<div class="user-item-ctrl">' +
          '<div class="token-group">' +
          '<img src="assets/coin.png" alt="" width="18" height="18" />' +
          '<input class="token-input" type="number" min="0" max="1000000" value="' +
          bal +
          '" data-orig="' +
          bal +
          '" aria-label="โทเค็น ' +
          name +
          '" />' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="save-tokens">บันทึก</button>' +
          "</div>" +
          (canDelete
            ? '<button type="button" class="btn btn-danger btn-sm" data-action="delete-user">ลบ</button>'
            : '<span class="muted tiny">' + (isSelf ? "คุณ" : "") + "</span>") +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  async function loadUsers() {
    const listStatus = $("list-status");
    const body = $("users-body");
    body.innerHTML = '<p class="muted user-items-empty">กำลังโหลด…</p>';
    try {
      const data = await api("/api/admin/users");
      renderUsers(data.users || []);
      setStatus(listStatus, "", "muted");
    } catch (e) {
      body.innerHTML = "";
      setStatus(listStatus, e.message, "err");
    }
  }

  async function saveTokens(item) {
    const userId = item.getAttribute("data-user-id");
    const input = item.querySelector(".token-input");
    const btn = item.querySelector('[data-action="save-tokens"]');
    const listStatus = $("list-status");
    const next = Math.max(0, Math.min(1_000_000, Number(input.value) || 0));
    const orig = Number(input.getAttribute("data-orig") || 0);
    if (next === orig) {
      setStatus(listStatus, "ไม่มีการเปลี่ยนแปลง", "muted");
      return;
    }
    btn.disabled = true;
    setStatus(listStatus, "กำลังบันทึกโทเค็น…", "muted");
    try {
      const data = await api("/api/admin/set-tokens", {
        method: "POST",
        body: { user_id: userId, token_balance: next, reason: "admin_set" },
      });
      input.value = String(data.token_balance ?? next);
      input.setAttribute("data-orig", String(data.token_balance ?? next));
      setStatus(listStatus, "อัปเดตโทเค็นแล้ว: " + (data.token_balance ?? next), "ok");
    } catch (err) {
      setStatus(listStatus, err.message || String(err), "err");
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteUser(item) {
    const userId = item.getAttribute("data-user-id");
    const name = item.querySelector(".user-name")?.textContent || userId;
    const listStatus = $("list-status");
    if (!window.confirm('ลบผู้ใช้ "' + name + '" ถาวร?\nบัญชี Auth + โปรไฟล์จะถูกลบ')) {
      return;
    }
    setStatus(listStatus, "กำลังลบ…", "muted");
    try {
      await api("/api/admin/users/" + encodeURIComponent(userId), {
        method: "DELETE",
      });
      setStatus(listStatus, "ลบแล้ว: " + name, "ok");
      await loadUsers();
    } catch (err) {
      setStatus(listStatus, err.message || String(err), "err");
    }
  }

  $("users-body").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const item = btn.closest("[data-user-id]");
    if (!item) return;
    const action = btn.getAttribute("data-action");
    if (action === "save-tokens") saveTokens(item);
    if (action === "delete-user") deleteUser(item);
  });

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

  $("refresh-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    loadUsers();
  });

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

  initAccordions();

  (async () => {
    const ctx = await requireAdminSession();
    if (ctx) await showDash(ctx.profile);
  })();
})();
