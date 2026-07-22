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
  const MOTION_CLOSE_MS = 320;
  const { createClient } = supabase;
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);
  const loginPanel = $("login-panel");
  const dash = $("dash");
  const modalRoot = $("modal-root");
  const modalTitle = $("modal-title");
  const modalBody = $("modal-body");
  const modalIcon = $("modal-icon");
  const modalActions = $("modal-actions");
  const modalCard = modalRoot?.querySelector(".modal-card") || null;

  let accessToken = null;
  let sessionToken = null;
  let adminId = null;
  let apiReady = false;
  let modalMode = null;
  let modalResolver = null;

  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "status " + (kind || "muted");
    if (text) {
      el.classList.remove("is-fresh");
      void el.offsetWidth;
      el.classList.add("is-fresh");
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) {
      return false;
    }
  }

  /* ---------- Adaptive floating bg (assets_web/bg) ---------- */
  const BG_FLOAT_BASE = "assets_web/bg/";
  const BG_FLOAT_COUNT = 70;
  const BG_EDGE_ZONES = [
    { top: [4, 22], left: [2, 18] },
    { top: [4, 22], left: [78, 94] },
    { top: [28, 48], left: [1, 12] },
    { top: [28, 48], left: [86, 96] },
    { top: [52, 72], left: [2, 16] },
    { top: [52, 72], left: [82, 95] },
    { top: [74, 90], left: [8, 28] },
    { top: [74, 90], left: [70, 90] },
    { top: [8, 18], left: [36, 62] },
  ];

  function bgFloatCountForWidth(w) {
    if (w < 480) return 3;
    if (w < 768) return 5;
    if (w < 1100) return 7;
    return 9;
  }

  function bgFloatSizeRange(w) {
    if (w < 480) return [36, 52];
    if (w < 768) return [40, 60];
    return [44, 72];
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function randBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function initBgFloaters() {
    const root = $("bg-floaters");
    if (!root) return;

    let lastCount = -1;
    let resizeTimer = 0;

    function rebuild() {
      const w = window.innerWidth || document.documentElement.clientWidth || 1024;
      const count = bgFloatCountForWidth(w);
      if (count === lastCount && root.childElementCount === count) return;
      lastCount = count;

      const indices = Array.from({ length: BG_FLOAT_COUNT }, (_, i) => i + 1);
      shuffleInPlace(indices);
      const picked = indices.slice(0, count);
      const zones = BG_EDGE_ZONES.slice();
      shuffleInPlace(zones);
      const [minW, maxW] = bgFloatSizeRange(w);

      root.replaceChildren();
      for (let i = 0; i < picked.length; i++) {
        const n = String(picked[i]).padStart(2, "0");
        const zone = zones[i % zones.length];
        const img = document.createElement("img");
        img.className = "float-deco";
        img.alt = "";
        img.decoding = "async";
        img.draggable = false;
        img.src = `${BG_FLOAT_BASE}upgrade02_${n}_shop.png`;
        const width = Math.round(randBetween(minW, maxW));
        const top = randBetween(zone.top[0], zone.top[1]);
        const left = randBetween(zone.left[0], zone.left[1]);
        const duration = randBetween(9, 16);
        const delay = -randBetween(0, 12);
        img.style.width = `${width}px`;
        img.style.top = `${top}%`;
        img.style.left = `${left}%`;
        img.style.animationDuration = `${duration.toFixed(1)}s`;
        img.style.animationDelay = `${delay.toFixed(1)}s`;
        root.appendChild(img);
      }
    }

    rebuild();
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuild, 180);
    });
  }

  function animateOpen(root) {
    if (!root) return;
    root.classList.remove("hidden", "is-closing");
    root.setAttribute("aria-hidden", "false");
    void root.offsetWidth;
    requestAnimationFrame(() => {
      root.classList.add("is-open");
    });
  }

  function animateClose(root, onDone, opts = {}) {
    const instant = !!opts.instant || prefersReducedMotion();
    if (!root) {
      if (typeof onDone === "function") onDone();
      return;
    }
    const finish = () => {
      root.classList.add("hidden");
      root.classList.remove("is-open", "is-closing");
      root.setAttribute("aria-hidden", "true");
      if (typeof onDone === "function") onDone();
    };
    if (instant || root.classList.contains("hidden")) {
      finish();
      return;
    }
    root.classList.add("is-closing");
    setTimeout(finish, MOTION_CLOSE_MS);
  }

  /* ---------- API health chip ---------- */
  function paintApiStatus(state, text) {
    const el = $("api-status");
    if (!el) return;
    el.className = "api-chip is-" + (state || "waking");
    el.textContent = text || "";
  }

  async function pingApiHealth(retries) {
    const tries = Math.max(1, Number(retries) || 1);
    paintApiStatus("waking", "กำลังปลุกเซิร์ฟเวอร์…");
    for (let i = 0; i < tries; i++) {
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = setTimeout(() => {
        try {
          ctrl?.abort();
        } catch (_) {}
      }, 4500);
      try {
        const res = await fetch(API + "/api/health", {
          method: "GET",
          signal: ctrl?.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          apiReady = true;
          paintApiStatus("ready", "API พร้อม");
          return true;
        }
      } catch (_) {
        clearTimeout(timer);
      }
      if (i < tries - 1) {
        paintApiStatus("waking", "กำลังปลุกเซิร์ฟเวอร์…");
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    apiReady = false;
    paintApiStatus("down", "API ยังไม่พร้อม");
    return false;
  }

  /* ---------- Modal system ---------- */
  function clearModalActions() {
    if (!modalActions) return;
    modalActions.innerHTML = "";
    modalActions.className = "modal-actions";
  }

  function makeBtn(label, className, onClick) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "btn " + className;
    el.addEventListener("click", onClick);
    el.appendChild(document.createTextNode(label));
    return el;
  }

  function settleModal(value) {
    const resolve = modalResolver;
    modalResolver = null;
    if (typeof resolve === "function") resolve(value);
  }

  function openModal({ mode, title, body, icon, locked, bodyHtml }) {
    if (!modalRoot) return;
    modalMode = mode;
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) {
      if (bodyHtml) modalBody.innerHTML = bodyHtml;
      else modalBody.textContent = body || "";
    }
    if (modalIcon) modalIcon.src = icon || "assets/coin.png";
    modalRoot.classList.toggle("locked", !!locked);
    const closeBtn = $("modal-close");
    if (closeBtn) {
      closeBtn.classList.toggle("is-hidden", !!locked);
      closeBtn.disabled = !!locked;
    }
    if (modalCard) {
      modalCard.classList.remove("is-shake");
      void modalCard.offsetWidth;
      if (mode === "error") modalCard.classList.add("is-shake");
    }
    animateOpen(modalRoot);
  }

  function forceCloseModal() {
    modalMode = null;
    clearModalActions();
    animateClose(
      modalRoot,
      () => {
        if (modalRoot) modalRoot.classList.remove("locked");
        if (modalCard) modalCard.classList.remove("is-shake");
      },
      { instant: true }
    );
  }

  function closeModalAndSettle(value) {
    modalMode = null;
    clearModalActions();
    animateClose(modalRoot, () => {
      if (modalRoot) modalRoot.classList.remove("locked");
      if (modalCard) modalCard.classList.remove("is-shake");
      settleModal(value);
    });
  }

  function showConfirmModal({
    title,
    body,
    confirmLabel,
    cancelLabel,
    danger,
    icon,
  } = {}) {
    return new Promise((resolve) => {
      modalResolver = resolve;
      clearModalActions();
      openModal({
        mode: "confirm",
        title: title || "ยืนยัน?",
        body: body || "",
        icon: icon || "assets/notice_b19.png",
        locked: false,
      });
      if (modalActions) {
        modalActions.classList.add("row");
        modalActions.appendChild(
          makeBtn(cancelLabel || "ยกเลิก", "btn-ghost", () => {
            closeModalAndSettle(false);
          })
        );
        modalActions.appendChild(
          makeBtn(
            confirmLabel || "ยืนยัน",
            danger ? "btn-danger" : "btn-candy",
            () => {
              closeModalAndSettle(true);
            }
          )
        );
      }
    });
  }

  function showPromptModal({
    title,
    body,
    placeholder,
    defaultValue,
    confirmLabel,
    cancelLabel,
    icon,
  } = {}) {
    return new Promise((resolve) => {
      modalResolver = resolve;
      clearModalActions();
      const inputId = "modal-prompt-input";
      openModal({
        mode: "prompt",
        title: title || "กรอกข้อมูล",
        bodyHtml:
          "<p>" +
          escapeHtml(body || "") +
          '</p><input id="' +
          inputId +
          '" class="modal-prompt-input" type="text" placeholder="' +
          escapeHtml(placeholder || "") +
          '" value="' +
          escapeHtml(defaultValue || "") +
          '" />',
        icon: icon || "assets/notice_b19.png",
        locked: false,
      });
      const input = $(inputId);
      if (input) {
        requestAnimationFrame(() => {
          input.focus();
          input.select();
        });
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            closeModalAndSettle(input.value);
          }
        });
      }
      if (modalActions) {
        modalActions.classList.add("row");
        modalActions.appendChild(
          makeBtn(cancelLabel || "ยกเลิก", "btn-ghost", () => {
            closeModalAndSettle(null);
          })
        );
        modalActions.appendChild(
          makeBtn(confirmLabel || "ตกลง", "btn-candy", () => {
            closeModalAndSettle(input ? input.value : "");
          })
        );
      }
    });
  }

  function showAlertModal({ title, body, confirmLabel, icon, mode } = {}) {
    return new Promise((resolve) => {
      modalResolver = resolve;
      clearModalActions();
      openModal({
        mode: mode || "alert",
        title: title || "แจ้งเตือน",
        body: body || "",
        icon: icon || "assets/notice_b19.png",
        locked: false,
      });
      if (modalActions) {
        modalActions.appendChild(
          makeBtn(confirmLabel || "ตกลง", "btn-candy", () => {
            closeModalAndSettle(undefined);
          })
        );
      }
    });
  }

  $("modal-close")?.addEventListener("click", () => {
    if (modalMode === "confirm") closeModalAndSettle(false);
    else if (modalMode === "prompt") closeModalAndSettle(null);
    else closeModalAndSettle(undefined);
  });

  modalRoot?.querySelector(".modal-backdrop")?.addEventListener("click", () => {
    if (modalMode === "confirm") closeModalAndSettle(false);
    else if (modalMode === "prompt") closeModalAndSettle(null);
    else if (modalMode === "alert" || modalMode === "error") closeModalAndSettle(undefined);
  });

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
            " โทเค็น · " +
            escapeHtml(baht) +
            "฿</strong>" +
            '<button type="button" class="btn btn-candy" data-action="credit-retry">เครดิตซ้ำ</button>' +
            "</div>" +
            '<div class="muted">ผู้ใช้: ' +
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
        root.textContent = "ยังไม่มีบันทึก";
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
            '<div class="muted">ผู้ทำ: ' +
            escapeHtml(row.actor_id || "—") +
            " · เป้าหมาย: " +
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
        "โทเค็นเติม: +" +
        escapeHtml(data.tokens_credited || 0) +
        " · ใช้ไป: -" +
        escapeHtml(data.tokens_consumed || 0) +
        "<br>" +
        "เติมเงิน: " +
        escapeHtml(data.topups || 0) +
        " · ต้องตามมือ: " +
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
    const confirmed = await showConfirmModal({
      title: "ลบผู้ใช้?",
      body: 'ลบผู้ใช้ "' + name + '" ถาวร?\nบัญชี Auth + โปรไฟล์จะถูกลบ',
      confirmLabel: "ลบถาวร",
      cancelLabel: "ยกเลิก",
      danger: true,
      icon: "assets/notice_b19.png",
    });
    if (!confirmed) return;
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
    const reasonRaw = await showPromptModal({
      title: "แบนผู้ใช้",
      body: 'เหตุผลแบน "' + name + '" (ว่างได้)',
      placeholder: "เหตุผล (ไม่บังคับ)",
      defaultValue: "",
      confirmLabel: "แบน",
      cancelLabel: "ยกเลิก",
    });
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
      await ensureApiReady();
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

  async function ensureApiReady() {
    if (apiReady) return true;
    return pingApiHealth(2);
  }

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
    const confirmed = await showConfirmModal({
      title: "เครดิตซ้ำ?",
      body: "ยืนยันเครดิตโทเค็นสำหรับรายการค้างนี้",
      confirmLabel: "เครดิตซ้ำ",
      cancelLabel: "ยกเลิก",
      icon: "assets/coin.png",
    });
    if (!confirmed) return;
    btn.disabled = true;
    try {
      await api("/api/admin/topups/" + encodeURIComponent(id) + "/credit", {
        method: "POST",
        body: {},
      });
      await Promise.all([loadStuckTopups(), loadUsers(), loadAudit()]);
    } catch (err) {
      await showAlertModal({
        title: "เครดิตไม่สำเร็จ",
        body: err.message || String(err),
        mode: "error",
      });
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
        "สร้างแล้ว: " + data.username + " · " + data.token_balance + " โทเค็น",
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
    $("lookup-result").textContent = "กำลังค้นหา…";
    try {
      const data = await api("/api/admin/lookup?q=" + encodeURIComponent(q));
      if (!data.ok) {
        $("lookup-result").textContent = data.reason || "ไม่พบผู้ใช้";
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
                    "โทเค็น · " +
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
        "</strong> · โทเค็น: " +
        escapeHtml(data.token_balance) +
        " · บทบาท: " +
        escapeHtml(data.role) +
        topupHtml;
      $("credit-q").value = data.username || q;
    } catch (err) {
      $("lookup-result").textContent = err.message;
    }
  });

  $("credit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus($("credit-status"), "กำลังเติมโทเค็น…", "muted");
    try {
      const data = await api("/api/admin/add-tokens", {
        method: "POST",
        body: {
          query: $("credit-q").value.trim(),
          amount: Number($("credit-amt").value) || 0,
          reason: "admin_credit",
        },
      });
      setStatus($("credit-status"), "ยอดใหม่: " + data.token_balance, "ok");
      await Promise.all([loadUsers(), loadAudit()]);
    } catch (err) {
      setStatus($("credit-status"), err.message, "err");
    }
  });

  initBgFloaters();
  initAccordions();
  sessionToken = loadStoredSessionToken();
  pingApiHealth(2).catch(() => {});

  (async () => {
    const ctx = await requireAdminSession();
    if (ctx) await showDash(ctx.profile);
  })();
})();
