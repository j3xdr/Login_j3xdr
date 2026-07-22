/* CKR Admin — Login_j3xdr (token system via Render API) */
(function () {
  "use strict";

  const cfg = window.PARTYRUN_CONFIG;
  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    document.body.innerHTML = "<p style='color:#f88;padding:2rem'>Missing config.js</p>";
    return;
  }

  const API = cfg.API_BASE || "";
  const SESSION_KEY = "ckr_admin_session_token";
  const { createClient } = supabase;
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);
  const loginPanel = $("login-panel");
  const dash = $("dash");

  let accessToken = null;
  let sessionToken = null;
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

  function loadStoredSessionToken() {
    try {
      return localStorage.getItem(SESSION_KEY) || null;
    } catch (_) {
      return null;
    }
  }

  function persistSessionToken(token) {
    sessionToken = token || null;
    try {
      if (!sessionToken) localStorage.removeItem(SESSION_KEY);
      else localStorage.setItem(SESSION_KEY, sessionToken);
    } catch (_) {}
  }

  function formatDay(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString("th-TH", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return "—";
    }
  }

  async function handleSessionReplaced() {
    try {
      await sb.auth.signOut();
    } catch (_) {}
    accessToken = null;
    persistSessionToken(null);
    showLogin();
    setStatus($("login-status"), "มีการเข้าสู่ระบบจากที่อื่น — กรุณาเข้าใหม่", "err");
  }

  async function api(path, options = {}) {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {}
    );
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    if (sessionToken) headers["X-Session-Token"] = sessionToken;
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
      const raw = data?.detail || data?.reason || res.statusText;
      const detail =
        typeof raw === "string"
          ? raw
          : raw && typeof raw === "object"
            ? raw.code || raw.message || JSON.stringify(raw)
            : String(raw);
      if (res.status === 401 && /session_replaced/i.test(String(detail))) {
        await handleSessionReplaced();
      }
      const err = new Error(detail);
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
    sessionToken = loadStoredSessionToken();
    try {
      const me = await api("/api/me");
      if (me?.profile?.role !== "admin") {
        await sb.auth.signOut();
        accessToken = null;
        persistSessionToken(null);
        return null;
      }
      return { session: sess.session, profile: me.profile };
    } catch (e) {
      if (!/session_replaced/i.test(String(e.message || ""))) {
        try {
          await sb.auth.signOut();
        } catch (_) {}
        persistSessionToken(null);
      }
      accessToken = null;
      return null;
    }
  }

  function setChromeLoggedIn(on) {
    $("logout-btn").classList.toggle("hidden", !on);
    const chip = $("nav-admin");
    if (chip) chip.classList.toggle("hidden", !on);
  }

  async function loadStuckTopups() {
    const root = $("stuck-topups");
    if (!root) return;
    root.textContent = "กำลังโหลด…";
    root.className = "admin-list muted";
    try {
      const data = await api("/api/admin/topups?status=needs_manual");
      const items = data.items || [];
      if (!items.length) {
        root.textContent = "ไม่มีรายการค้าง";
        return;
      }
      root.className = "admin-list";
      root.innerHTML = items
        .map((row) => {
          const id = escapeHtml(row.id || "");
          const baht = Number(row.amount_baht ?? 0);
          const tokens = escapeHtml(row.tokens_credited || row.package_tokens || "—");
          return (
            '<div class="admin-row" data-redemption-id="' +
            id +
            '">' +
            '<div class="admin-row-head">' +
            "<strong>" +
            tokens +
            " Token · " +
            escapeHtml(baht) +
            "฿</strong>" +
            '<button type="button" class="btn btn-candy" data-action="credit-retry">เครดิตซ้ำ</button>' +
            "</div>" +
            '<div class="muted">user: ' +
            escapeHtml(row.user_id) +
            " · " +
            escapeHtml(formatDay(row.created_at)) +
            "</div>" +
            (row.error_note
              ? '<div class="muted">' + escapeHtml(row.error_note) + "</div>"
              : "") +
            "</div>"
          );
        })
        .join("");
    } catch (e) {
      root.textContent = e.message || String(e);
    }
  }

  async function loadAudit() {
    const root = $("audit-list");
    if (!root) return;
    root.textContent = "กำลังโหลด…";
    root.className = "admin-list muted";
    try {
      const data = await api("/api/admin/audit?limit=40");
      const items = data.items || [];
      if (!items.length) {
        root.textContent = "ยังไม่มี log";
        return;
      }
      root.className = "admin-list";
      root.innerHTML = items
        .map((row) => {
          const meta = row.meta ? JSON.stringify(row.meta) : "";
          return (
            '<div class="admin-row">' +
            '<div class="admin-row-head"><strong>' +
            escapeHtml(row.action) +
            "</strong><span class=\"muted\">" +
            escapeHtml(formatDay(row.created_at)) +
            "</span></div>" +
            '<div class="muted">actor: ' +
            escapeHtml(row.actor_id || "—") +
            " · target: " +
            escapeHtml(row.target_user_id || "—") +
            "</div>" +
            (meta
              ? '<div class="muted">' + escapeHtml(meta) + "</div>"
              : "") +
            "</div>"
          );
        })
        .join("");
    } catch (e) {
      root.textContent = e.message || String(e);
    }
  }

  async function loadStats() {
    const root = $("daily-stats");
    if (!root) return;
    root.textContent = "กำลังโหลด…";
    root.className = "stats-box muted";
    try {
      const data = await api("/api/admin/stats");
      const runs = data.runs || {};
      root.className = "stats-box";
      root.innerHTML =
        "<strong>วันที่ " +
        escapeHtml(data.date) +
        "</strong><br>" +
        "ฟาร์มทั้งหมด: " +
        escapeHtml(data.runs_total || 0) +
        " (สำเร็จ " +
        escapeHtml(runs.succeeded || 0) +
        " · ล้ม " +
        escapeHtml(runs.failed || 0) +
        ")<br>" +
        "โทเค็น credit: +" +
        escapeHtml(data.tokens_credited || 0) +
        " · consume: -" +
        escapeHtml(data.tokens_consumed || 0) +
        "<br>" +
        "เติมเงิน: " +
        escapeHtml(data.topups || 0) +
        " · needs_manual: " +
        escapeHtml(data.topups_needs_manual || 0);
    } catch (e) {
      root.textContent = e.message || String(e);
    }
  }

  async function loadSettings() {
    try {
      const data = await api("/api/admin/settings");
      if ($("set-farm-maint")) $("set-farm-maint").checked = !!data.farm_maintenance;
      if ($("set-topup-maint")) $("set-topup-maint").checked = !!data.topup_maintenance;
    } catch (_) {}
  }

  async function showDash(profile) {
    loginPanel.classList.add("hidden");
    dash.classList.remove("hidden");
    setChromeLoggedIn(true);
    adminId = profile.id || null;
    $("who-user").textContent = profile.username || profile.display_name || "admin";
    initAccordions();
    await Promise.all([
      loadUsers(),
      loadStuckTopups(),
      loadAudit(),
      loadStats(),
      loadSettings(),
    ]);
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
        const banned = !!u.banned_at;
        const canDelete = !isSelf && !isAdmin;
        const canBan = !isSelf && !isAdmin;
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
          (banned ? '<span class="banned-tag">ถูกแบน</span>' : "") +
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
          (canBan
            ? banned
              ? '<button type="button" class="btn btn-ghost btn-sm" data-action="unban-user">ปลดแบน</button>'
              : '<button type="button" class="btn btn-ghost btn-sm" data-action="ban-user">แบน</button>'
            : "") +
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
      loadAudit().catch(() => {});
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
      await Promise.all([loadUsers(), loadAudit()]);
    } catch (err) {
      setStatus(listStatus, err.message || String(err), "err");
    }
  }

  async function banUser(item) {
    const userId = item.getAttribute("data-user-id");
    const name = item.querySelector(".user-name")?.textContent || userId;
    const listStatus = $("list-status");
    const reasonRaw = window.prompt('เหตุผลแบน "' + name + '" (ว่างได้)', "");
    if (reasonRaw === null) return;
    const reason = String(reasonRaw).trim();
    setStatus(listStatus, "กำลังแบน…", "muted");
    try {
      await api("/api/admin/users/" + encodeURIComponent(userId) + "/ban", {
        method: "POST",
        body: { reason },
      });
      setStatus(listStatus, "แบนแล้ว: " + name, "ok");
      await Promise.all([loadUsers(), loadAudit()]);
    } catch (err) {
      setStatus(listStatus, err.message || String(err), "err");
    }
  }

  async function unbanUser(item) {
    const userId = item.getAttribute("data-user-id");
    const name = item.querySelector(".user-name")?.textContent || userId;
    const listStatus = $("list-status");
    setStatus(listStatus, "กำลังปลดแบน…", "muted");
    try {
      await api("/api/admin/users/" + encodeURIComponent(userId) + "/unban", {
        method: "POST",
        body: {},
      });
      setStatus(listStatus, "ปลดแบนแล้ว: " + name, "ok");
      await Promise.all([loadUsers(), loadAudit()]);
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
    if (action === "ban-user") banUser(item);
    if (action === "unban-user") unbanUser(item);
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
      persistSessionToken(data.session_token || null);
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
    persistSessionToken(null);
    showLogin();
    setStatus($("login-status"), "ออกจากระบบแล้ว", "muted");
  });

  $("refresh-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    loadUsers();
  });

  $("refresh-stuck-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    loadStuckTopups();
  });

  $("refresh-audit-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    loadAudit();
  });

  $("refresh-stats-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    loadStats();
  });

  $("save-settings-btn")?.addEventListener("click", async () => {
    setStatus($("settings-status"), "กำลังบันทึก…", "muted");
    try {
      await api("/api/admin/settings", {
        method: "POST",
        body: {
          farm_maintenance: !!$("set-farm-maint")?.checked,
          topup_maintenance: !!$("set-topup-maint")?.checked,
        },
      });
      setStatus($("settings-status"), "บันทึกสถานะแล้ว", "ok");
      await Promise.all([loadSettings(), loadAudit()]);
    } catch (err) {
      setStatus($("settings-status"), err.message || String(err), "err");
    }
  });

  $("stuck-topups")?.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="credit-retry"]');
    if (!btn) return;
    const row = btn.closest("[data-redemption-id]");
    const id = row?.getAttribute("data-redemption-id");
    if (!id) return;
    btn.disabled = true;
    try {
      await api("/api/admin/topups/" + encodeURIComponent(id) + "/credit", {
        method: "POST",
        body: {},
      });
      await Promise.all([loadStuckTopups(), loadUsers(), loadAudit()]);
    } catch (err) {
      window.alert(err.message || String(err));
    } finally {
      btn.disabled = false;
    }
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
      await Promise.all([loadUsers(), loadAudit()]);
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
      let topupHtml = "";
      if (data.id) {
        try {
          const top = await api(
            "/api/admin/users/" + encodeURIComponent(data.id) + "/topups"
          );
          const items = top.items || [];
          if (items.length) {
            topupHtml =
              '<div class="lookup-topups"><strong>เติมล่าสุด</strong><ul>' +
              items
                .map((row) => {
                  const st =
                    row.credit_status === "needs_manual" ? "ต้องตามมือ" : "สำเร็จ";
                  return (
                    "<li>" +
                    escapeHtml(formatDay(row.created_at)) +
                    " · " +
                    escapeHtml(row.tokens_credited || row.package_tokens) +
                    "T · " +
                    escapeHtml(row.amount_baht) +
                    "฿ · " +
                    st +
                    "</li>"
                  );
                })
                .join("") +
              "</ul></div>";
          }
        } catch (_) {}
      }
      $("lookup-result").innerHTML =
        "<strong>" +
        escapeHtml(data.username || q) +
        "</strong> · tokens: " +
        escapeHtml(data.token_balance) +
        " · role: " +
        escapeHtml(data.role) +
        topupHtml;
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
      await Promise.all([loadUsers(), loadAudit()]);
    } catch (err) {
      setStatus($("credit-status"), err.message, "err");
    }
  });

  initAccordions();
  sessionToken = loadStoredSessionToken();

  (async () => {
    const ctx = await requireAdminSession();
    if (ctx) await showDash(ctx.profile);
  })();
})();
