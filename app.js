/* CKR Admin Console — POS dashboard (PC + Web rental days) */
(function () {
  "use strict";

  const cfg = window.PARTYRUN_CONFIG;
  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    document.body.innerHTML =
      "<p style='color:#f88;padding:2rem;font-family:sans-serif'>Missing config.js</p>";
    return;
  }

  const API = cfg.API_BASE || "";
  const SESSION_KEY = "ckr_admin_session_token";
  const MODE_KEY = "ckr_admin_mode";
  const EDGE_ADMIN_FN = "admin-register";
  const { createClient } = supabase;
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);

  /* Floating bg deco — assets_web/bg (parent folder) */
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
    if (w < 480) return [32, 48];
    if (w < 768) return [36, 54];
    return [40, 64];
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
        img.style.width = `${width}px`;
        img.style.top = `${randBetween(zone.top[0], zone.top[1])}%`;
        img.style.left = `${randBetween(zone.left[0], zone.left[1])}%`;
        img.style.animationDuration = `${9 + Math.random() * 5}s`;
        img.style.animationDelay = `${-Math.random() * 8}s`;
        root.appendChild(img);
      }
    }

    rebuild();
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuild, 180);
    });
  }

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
  let adminMode = (() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      return m === "web" || m === "token" ? "web" : "day";
    } catch (_) {
      return "day";
    }
  })();
  let currentView = "overview";
  let cachedUsers = [];
  let lastStats = null;

  function setStatus(el, text, kind) {
    if (!el) return;
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

  function paintApiStatus(state, text) {
    const el = $("api-status");
    if (!el) return;
    el.className = "api-chip is-" + (state || "waking");
    el.textContent = text || "";
  }

  async function pingApiHealth(retries) {
    const tries = Math.max(1, Number(retries) || 1);
    paintApiStatus("waking", "กำลังปลุก API…");
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(API + "/api/health", { method: "GET" });
        if (res.ok) {
          apiReady = true;
          paintApiStatus("ready", "API พร้อม");
          return true;
        }
      } catch (_) {}
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 1000));
    }
    apiReady = false;
    paintApiStatus("down", "API ไม่พร้อม");
    return false;
  }

  async function ensureApiReady() {
    if (apiReady) return true;
    return pingApiHealth(2);
  }

  /* ---- Modal ---- */
  function clearModalActions() {
    if (modalActions) {
      modalActions.innerHTML = "";
      modalActions.className = "modal-actions";
    }
  }

  function makeBtn(label, className, onClick) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = className || "btn btn-primary";
    el.textContent = label;
    el.addEventListener("click", onClick);
    return el;
  }

  function settleModal(value) {
    const r = modalResolver;
    modalResolver = null;
    if (r) r(value);
  }

  function openModal({ mode, title, body, icon, locked, bodyHtml }) {
    modalMode = mode;
    modalTitle.textContent = title;
    if (bodyHtml) modalBody.innerHTML = bodyHtml;
    else modalBody.textContent = body || "";
    modalIcon.src = icon || "assets/coin.png";
    modalRoot.classList.remove("hidden");
    modalRoot.setAttribute("aria-hidden", "false");
    const closeBtn = $("modal-close");
    if (closeBtn) closeBtn.classList.toggle("hidden", !!locked);
  }

  function forceCloseModal() {
    modalMode = null;
    clearModalActions();
    modalRoot.classList.add("hidden");
    modalRoot.setAttribute("aria-hidden", "true");
  }

  function closeModalAndSettle(value) {
    forceCloseModal();
    settleModal(value);
  }

  function showConfirmModal({
    title,
    body,
    confirmLabel,
    cancelLabel,
    danger,
    icon,
  }) {
    return new Promise((resolve) => {
      modalResolver = resolve;
      clearModalActions();
      openModal({
        mode: "confirm",
        title: title || "ยืนยัน",
        body: body || "",
        icon: icon || "assets/notice_b19.png",
      });
      modalActions.classList.add("row");
      modalActions.appendChild(
        makeBtn(cancelLabel || "ยกเลิก", "btn btn-ghost", () =>
          closeModalAndSettle(false)
        )
      );
      modalActions.appendChild(
        makeBtn(
          confirmLabel || "ยืนยัน",
          danger ? "btn btn-danger" : "btn btn-primary",
          () => closeModalAndSettle(true)
        )
      );
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
  }) {
    return new Promise((resolve) => {
      modalResolver = resolve;
      clearModalActions();
      openModal({
        mode: "prompt",
        title: title || "กรอกข้อมูล",
        body: "",
        bodyHtml:
          "<p>" +
          escapeHtml(body || "") +
          '</p><input class="prompt-input" id="modal-prompt-input" type="text" />',
        icon: icon || "assets/score.png",
      });
      const input = $("modal-prompt-input");
      if (input) {
        input.placeholder = placeholder || "";
        input.value = defaultValue || "";
        setTimeout(() => input.focus(), 30);
      }
      modalActions.classList.add("row");
      modalActions.appendChild(
        makeBtn(cancelLabel || "ยกเลิก", "btn btn-ghost", () =>
          closeModalAndSettle(null)
        )
      );
      modalActions.appendChild(
        makeBtn(confirmLabel || "ตกลง", "btn btn-primary", () => {
          closeModalAndSettle(input ? input.value : "");
        })
      );
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
      });
      modalActions.appendChild(
        makeBtn(confirmLabel || "ตกลง", "btn btn-primary", () =>
          closeModalAndSettle(true)
        )
      );
    });
  }

  $("modal-close")?.addEventListener("click", () => {
    if (modalMode === "prompt") closeModalAndSettle(null);
    else if (modalMode === "confirm") closeModalAndSettle(false);
    else closeModalAndSettle(true);
  });

  /* ---- Session / API ---- */
  function loadStoredSessionToken() {
    try {
      return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    } catch (_) {
      return null;
    }
  }

  function persistSessionToken(token) {
    sessionToken = token || null;
    try {
      if (!token) {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(SESSION_KEY, token);
      }
    } catch (_) {}
  }

  function formatDay(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) {
      return "—";
    }
  }

  function readDuration(prefix) {
    return {
      days: Math.max(0, Math.floor(Number($(prefix + "-days")?.value) || 0)),
      hours: Math.max(0, Math.floor(Number($(prefix + "-hours")?.value) || 0)),
      minutes: Math.max(0, Math.floor(Number($(prefix + "-minutes")?.value) || 0)),
    };
  }

  function hasDuration(d) {
    return (d.days || 0) > 0 || (d.hours || 0) > 0 || (d.minutes || 0) > 0;
  }

  function readFreeTrial(prefix) {
    const block = $(prefix + "-duration-block");
    return block?.dataset?.freeTrial === "1";
  }

  function setFreeTrial(prefix, on) {
    const block = $(prefix + "-duration-block");
    if (block) block.dataset.freeTrial = on ? "1" : "0";
  }

  function parseDatetimeLocal(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    if (d.getTime() <= Date.now()) {
      throw new Error("วันหมดอายุต้องอยู่ในอนาคต");
    }
    return d.toISOString();
  }

  async function resolveUserId(username, userId) {
    if (userId) return userId;
    if (!username) throw new Error("user_required");
    const looked = await api("/api/admin/lookup?q=" + encodeURIComponent(username));
    if (!looked?.ok || !looked.id) {
      throw new Error(looked?.reason || "ไม่พบผู้ใช้");
    }
    return looked.id;
  }

  function formatRemaining(expiresAt) {
    if (!expiresAt) return "—";
    const exp = new Date(expiresAt);
    if (Number.isNaN(exp.getTime())) return "—";
    const ms = exp.getTime() - Date.now();
    if (ms <= 0) return "หมดอายุ";
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const mins = totalMin % 60;
    const parts = [];
    if (days) parts.push(days + " วัน");
    if (hours) parts.push(hours + " ชม.");
    if (mins || !parts.length) parts.push(mins + " นาที");
    return "เหลือ " + parts.join(" ");
  }

  function expiryAt(u) {
    if (!u) return null;
    if (adminMode === "web") return u.rental_expires_at ?? u.expires_at ?? null;
    return u.expires_at ?? u.rental_expires_at ?? null;
  }

  function enrichUser(row) {
    if (!row) return row;
    const cached = cachedUsers.find(
      (u) =>
        (row.id && u.id === row.id) ||
        (row.username && u.username && u.username === row.username)
    );
    return cached ? { ...row, ...cached } : row;
  }

  function rentalStatus(u) {
    if (u.banned_at) {
      return { kind: "banned", label: "ถูกแบน", detail: formatDay(u.banned_at) };
    }
    if (u.is_permanent) {
      return { kind: "permanent", label: "ถาวร", detail: "ไม่หมดอายุ" };
    }
    const expires = expiryAt(u);
    if (!expires) {
      return { kind: "unset", label: "ยังไม่ตั้งวัน", detail: "—" };
    }
    const exp = new Date(expires);
    if (Number.isNaN(exp.getTime()) || exp.getTime() <= Date.now()) {
      return { kind: "expired", label: "หมดอายุ", detail: formatDay(expires) };
    }
    return {
      kind: "active",
      label: formatRemaining(expires),
      detail: "หมด " + formatDay(expires),
    };
  }

  function syncDurationVisibility(prefix) {
    const permanent = !!$(prefix + "-permanent")?.checked;
    const block = $(prefix + "-duration-block");
    if (block) block.classList.toggle("is-disabled", permanent);
    ["days", "hours", "minutes"].forEach((k) => {
      const el = $(prefix + "-" + k);
      if (el) el.disabled = permanent;
    });
  }

  function describeRentalUser(u) {
    const st = rentalStatus(u);
    return (
      "<strong>" +
      escapeHtml(u.username || "—") +
      "</strong> · " +
      escapeHtml(st.label) +
      (st.detail && st.detail !== "—"
        ? ' <span class="muted">(' + escapeHtml(st.detail) + ")</span>"
        : "") +
      " · บทบาท: " +
      escapeHtml(u.role || "normal")
    );
  }

  function paintReceipt(lines) {
    const box = $("receipt-box");
    if (!box) return;
    box.className = "receipt-box";
    box.textContent = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
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

  async function applyRentalChange({
    username,
    userId,
    permanent,
    duration,
    revoke,
    freeTrial,
  }) {
    if (adminMode === "day") {
      if (revoke) {
        return invokeAdminRental({ action: "revoke", username });
      }
      if (permanent) {
        return invokeAdminRental({ action: "make_permanent", username, permanent: true });
      }
      return invokeAdminRental({
        action: "extend",
        username,
        days: duration.days,
        hours: duration.hours,
        minutes: duration.minutes,
      });
    }

    const uid = await resolveUserId(username, userId);

    if (revoke) {
      const out = await api("/api/admin/rental/set-expires", {
        method: "POST",
        body: { user_id: uid, rental_expires_at: null },
      });
      return {
        user: {
          id: uid,
          username,
          rental_expires_at: null,
          is_permanent: false,
          ...out,
        },
      };
    }

    if (permanent) {
      const out = await api("/api/admin/rental/set-permanent", {
        method: "POST",
        body: { user_id: uid, permanent: true },
      });
      return {
        user: {
          id: uid,
          username,
          is_permanent: true,
          rental_expires_at: out.rental_expires_at ?? null,
        },
      };
    }

    const body = {
      user_id: uid,
      reason: freeTrial ? "free_trial" : "admin_grant",
    };
    if (duration.days > 0) {
      if (duration.hours > 0 || duration.minutes > 0) {
        throw new Error("โหมด Web ใส่ได้เฉพาะวัน หรือ ชม. (อย่างใดอย่างหนึ่ง)");
      }
      body.days = duration.days;
    } else {
      const totalHours = duration.hours + (duration.minutes > 0 ? 1 : 0);
      if (totalHours < 1) throw new Error("ต้องระบุอย่างน้อย 1 วัน หรือ 1 ชม.");
      body.hours = Math.min(8760, totalHours);
    }

    const out = await api("/api/admin/rental/grant", { method: "POST", body });
    return {
      user: {
        id: uid,
        username,
        rental_expires_at: out.rental_expires_at,
        is_permanent: !!out.is_permanent,
      },
    };
  }

  async function setRentalExpiresAt({ username, userId, expiresAtIso }) {
    if (!expiresAtIso) throw new Error("expires_at_required");

    if (adminMode === "day") {
      const data = await invokeAdminRental({
        action: "set_expires",
        username,
        expires_at: expiresAtIso,
      });
      return { user: data.user || { username, expires_at: expiresAtIso } };
    }

    const uid = await resolveUserId(username, userId);
    const out = await api("/api/admin/rental/set-expires", {
      method: "POST",
      body: { user_id: uid, rental_expires_at: expiresAtIso },
    });
    return {
      user: {
        id: uid,
        username,
        rental_expires_at: out.rental_expires_at ?? expiresAtIso,
        is_permanent: false,
      },
    };
  }

  async function createAccount({ username, password, permanent, duration, freeTrial }) {
    if (adminMode === "day") {
      return invokeAdminRental({
        action: "create",
        username,
        password,
        permanent,
        days: duration.days,
        hours: duration.hours,
        minutes: duration.minutes,
      });
    }

    const created = await api("/api/admin/create-user", {
      method: "POST",
      body: { username, password, initial_tokens: 0 },
    });
    const uid = created.id;
    let user = {
      id: uid,
      username: created.username || username,
      is_permanent: false,
      rental_expires_at: null,
    };
    if (permanent || hasDuration(duration)) {
      const out = await applyRentalChange({
        userId: uid,
        username,
        permanent,
        duration,
        freeTrial,
      });
      user = out.user || user;
    }
    return { ok: true, action: "create", user };
  }

  function rentalReceiptExpiry(u) {
    const exp = expiryAt(u);
    return exp ? formatDay(exp) : "ถาวร";
  }

  async function invokeAdminRental(body) {
    const { data, error } = await sb.functions.invoke(EDGE_ADMIN_FN, { body });
    if (error) {
      let detail = error.message || "edge_invoke_failed";
      try {
        const ctx = error.context;
        if (ctx && typeof ctx.json === "function") {
          const errBody = await ctx.json();
          if (errBody?.error) detail = errBody.error;
          else if (errBody?.detail) detail = errBody.detail;
          else if (errBody?.reason) detail = errBody.reason;
        }
      } catch (_) {}
      if (data?.error) detail = data.error;
      throw new Error(detail);
    }
    if (!data || data.ok === false) {
      throw new Error(data?.error || data?.reason || "rental_failed");
    }
    return data;
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

  /* ---- Mode / View ---- */
  function setMode(mode) {
    adminMode = mode === "web" || mode === "token" ? "web" : "day";
    try {
      localStorage.setItem(MODE_KEY, adminMode);
    } catch (_) {}
    dash?.classList.toggle("mode-day", adminMode === "day");
    dash?.classList.toggle("mode-web", adminMode === "web");
    $("mode-day")?.classList.toggle("is-active", adminMode === "day");
    $("mode-web")?.classList.toggle("is-active", adminMode === "web");
    const hint =
      adminMode === "day" ? "โหมด: เช่าวัน (PC)" : "โหมด: เช่าวัน (Web)";
    if ($("overview-mode-hint")) $("overview-mode-hint").textContent = hint;
    if ($("cashier-mode-hint")) {
      $("cashier-mode-hint").textContent =
        adminMode === "day"
          ? "เปิดสิทธิ์วันใช้งาน (PC)"
          : "เปิดสิทธิ์วันใช้งาน (Web)";
    }
    if ($("kpi-extra-label")) {
      $("kpi-extra-label").textContent =
        adminMode === "web" ? "เติมเงินวันนี้" : "เติมเงิน (Web)";
    }
    loadUsers();
    paintKpis();
  }

  function showView(name) {
    currentView = name || "overview";
    document.querySelectorAll(".pos-view").forEach((el) => {
      el.classList.toggle("is-active", el.getAttribute("data-panel") === currentView);
    });
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === currentView);
    });
  }

  function paintKpis() {
    const total = cachedUsers.length;
    let active = 0;
    let expired = 0;
    cachedUsers.forEach((u) => {
      const st = rentalStatus(u);
      if (st.kind === "active" || st.kind === "permanent") active += 1;
      else if (st.kind === "expired" || st.kind === "unset") expired += 1;
    });
    if ($("kpi-users")) $("kpi-users").textContent = String(total);
    if ($("kpi-active")) $("kpi-active").textContent = String(active);
    if ($("kpi-expired")) $("kpi-expired").textContent = String(expired);
    if ($("kpi-extra")) {
      if (adminMode === "web" && lastStats) {
        $("kpi-extra").textContent = String(lastStats.topups ?? "—");
      } else {
        $("kpi-extra").textContent = "—";
      }
    }
  }

  /* ---- Data loaders ---- */
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
          const days =
            row.days_credited || row.package_days || row.package_tokens || row.tokens_credited || "—";
          return (
            '<div class="admin-row" data-redemption-id="' +
            id +
            '">' +
            '<div class="admin-row-head"><strong>' +
            escapeHtml(days) +
            " วัน · " +
            escapeHtml(baht) +
            "฿</strong>" +
            '<button type="button" class="btn btn-primary btn-sm" data-action="credit-retry">เครดิตซ้ำ</button></div>' +
            '<div class="muted">ผู้ใช้: ' +
            escapeHtml(row.user_id) +
            " · " +
            escapeHtml(formatDay(row.created_at)) +
            "</div></div>"
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
          return (
            '<div class="admin-row"><div class="admin-row-head"><strong>' +
            escapeHtml(row.action) +
            '</strong><span class="muted">' +
            escapeHtml(formatDay(row.created_at)) +
            "</span></div>" +
            '<div class="muted">ผู้ทำ: ' +
            escapeHtml(row.actor_id || "—") +
            " · เป้าหมาย: " +
            escapeHtml(row.target_user_id || "—") +
            "</div></div>"
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
      lastStats = data;
      const runs = data.runs || {};
      root.className = "stats-box";
      root.innerHTML =
        "<strong>วันที่ " +
        escapeHtml(data.date) +
        "</strong><br>ฟาร์ม: " +
        escapeHtml(data.runs_total || 0) +
        " (สำเร็จ " +
        escapeHtml(runs.succeeded || 0) +
        " · ล้ม " +
        escapeHtml(runs.failed || 0) +
        ")" +
        (adminMode === "web"
          ? "<br>เติมเงิน: " +
            escapeHtml(data.topups || 0) +
            " · ตามมือ: " +
            escapeHtml(data.topups_needs_manual || 0)
          : "");
      paintKpis();
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

  function renderUsers(users) {
    const thead = $("users-thead");
    const body = $("users-body");
    if (!thead || !body) return;

    thead.innerHTML =
      "<tr><th>ชื่อผู้ใช้</th><th>บทบาท</th><th>สถานะเช่า</th><th>รายละเอียด</th><th>การทำงาน</th></tr>";

    if (!users.length) {
      body.innerHTML =
        '<tr><td class="muted" colspan="5">ยังไม่มีผู้ใช้</td></tr>';
      return;
    }

    body.innerHTML = users
      .map((u) => {
        const id = escapeHtml(u.id || "");
        const name = escapeHtml(u.username || "—");
        const unameAttr = escapeHtml(u.username || "");
        const role = escapeHtml(u.role || "normal");
        const isSelf = adminId && u.id === adminId;
        const isAdmin = (u.role || "normal") === "admin";
        const banned = !!u.banned_at;
        const canMutate = !isSelf && !isAdmin;
        const st = rentalStatus(u);

        const midCols =
          '<td data-label="สถานะเช่า"><span class="tag tag-' +
          st.kind +
          '">' +
          escapeHtml(st.label) +
          '</span></td><td data-label="รายละเอียด" class="muted">' +
          escapeHtml(st.detail) +
          "</td>";

        const actions = [];
        if (canMutate) {
          actions.push(
            '<button type="button" class="btn btn-primary btn-sm" data-action="quick-extend">ต่ออายุ</button>'
          );
          actions.push(
            '<button type="button" class="btn btn-ghost btn-sm" data-action="make-permanent">ถาวร</button>'
          );
        }
        if (canMutate) {
          if (banned) {
            actions.push(
              '<button type="button" class="btn btn-ghost btn-sm" data-action="unban-user">ปลดแบน</button>'
            );
          } else {
            actions.push(
              '<button type="button" class="btn btn-ghost btn-sm" data-action="ban-user">แบน</button>'
            );
          }
          actions.push(
            '<button type="button" class="btn btn-danger btn-sm" data-action="delete-user">ลบ</button>'
          );
        } else if (isSelf) {
          actions.push('<span class="muted">คุณ</span>');
        }

        return (
          '<tr data-user-id="' +
          id +
          '" data-username="' +
          unameAttr +
          '"><td data-label="ชื่อผู้ใช้"><strong class="user-name">' +
          name +
          '</strong></td><td data-label="บทบาท"><span class="tag tag-role">' +
          role +
          "</span></td>" +
          midCols +
          '<td data-label="การทำงาน"><div class="row-actions">' +
          actions.join("") +
          "</div></td></tr>"
        );
      })
      .join("");
  }

  async function loadUsers() {
    const listStatus = $("list-status");
    const body = $("users-body");
    if (body) {
      body.innerHTML =
        '<tr><td class="muted" colspan="5">กำลังโหลด…</td></tr>';
    }
    try {
      let users = null;
      if (adminMode === "day") {
        try {
          const { data, error } = await sb.rpc("admin_list_profiles");
          if (!error && Array.isArray(data)) users = data;
        } catch (_) {}
      }
      if (!users) {
        const data = await api("/api/admin/users");
        users = data.users || [];
      }
      cachedUsers = users;
      renderUsers(users);
      paintKpis();
      setStatus(listStatus, "", "muted");
    } catch (e) {
      if (body) body.innerHTML = "";
      setStatus(listStatus, e.message, "err");
    }
  }

  async function showDash(profile) {
    loginPanel.classList.add("hidden");
    dash.classList.remove("hidden");
    adminId = profile.id || null;
    const whoName = profile.username || profile.display_name || "admin";
    if ($("who-user")) $("who-user").textContent = whoName;
    if ($("who-user-mobile")) $("who-user-mobile").textContent = whoName;
    setMode(adminMode);
    showView("overview");
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
    adminId = null;
    cachedUsers = [];
  }

  /* ---- User actions ---- */
  async function deleteUser(row) {
    const userId = row.getAttribute("data-user-id");
    const name = row.querySelector(".user-name")?.textContent || userId;
    const listStatus = $("list-status");
    const confirmed = await showConfirmModal({
      title: "ลบผู้ใช้?",
      body: 'ลบผู้ใช้ "' + name + '" ถาวร?',
      confirmLabel: "ลบถาวร",
      cancelLabel: "ยกเลิก",
      danger: true,
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

  async function banUser(row) {
    const userId = row.getAttribute("data-user-id");
    const name = row.querySelector(".user-name")?.textContent || userId;
    const listStatus = $("list-status");
    const reasonRaw = await showPromptModal({
      title: "แบนผู้ใช้",
      body: 'เหตุผลแบน "' + name + '" (ว่างได้)',
      placeholder: "เหตุผล",
      defaultValue: "",
      confirmLabel: "แบน",
      cancelLabel: "ยกเลิก",
    });
    if (reasonRaw === null) return;
    setStatus(listStatus, "กำลังแบน…", "muted");
    try {
      await api("/api/admin/users/" + encodeURIComponent(userId) + "/ban", {
        method: "POST",
        body: { reason: String(reasonRaw).trim() },
      });
      setStatus(listStatus, "แบนแล้ว: " + name, "ok");
      await Promise.all([loadUsers(), loadAudit()]);
    } catch (err) {
      setStatus(listStatus, err.message || String(err), "err");
    }
  }

  async function unbanUser(row) {
    const userId = row.getAttribute("data-user-id");
    const name = row.querySelector(".user-name")?.textContent || userId;
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

  async function quickExtendUser(row) {
    const username = row.getAttribute("data-username") || "";
    const name = row.querySelector(".user-name")?.textContent || username;
    const listStatus = $("list-status");
    if (!username) return;
    const daysRaw = await showPromptModal({
      title: "ต่ออายุ",
      body: 'เพิ่มกี่วันให้ "' + name + '"?',
      placeholder: "จำนวนวัน",
      defaultValue: "1",
      confirmLabel: "ต่ออายุ",
      cancelLabel: "ยกเลิก",
      icon: "assets/score.png",
    });
    if (daysRaw === null) return;
    const days = Math.max(0, Math.floor(Number(daysRaw) || 0));
    if (days < 1) {
      setStatus(listStatus, "ต้องระบุอย่างน้อย 1 วัน", "err");
      return;
    }
    setStatus(listStatus, "กำลังต่ออายุ…", "muted");
    try {
      const data = await applyRentalChange({ username, duration: { days, hours: 0, minutes: 0 } });
      const u = data.user || {};
      setStatus(
        listStatus,
        "ต่ออายุแล้ว · หมด " + rentalReceiptExpiry(u),
        "ok"
      );
      paintReceipt([
        "ต่ออายุ",
        "User: " + (u.username || username),
        "หมดอายุ: " + rentalReceiptExpiry(u),
      ]);
      await loadUsers();
    } catch (err) {
      setStatus(listStatus, err.message || String(err), "err");
    }
  }

  async function makePermanentUser(row) {
    const username = row.getAttribute("data-username") || "";
    const name = row.querySelector(".user-name")?.textContent || username;
    const listStatus = $("list-status");
    if (!username) return;
    const confirmed = await showConfirmModal({
      title: "ตั้งถาวร?",
      body: 'ตั้ง "' + name + '" เป็นบัญชีถาวร?',
      confirmLabel: "ตั้งถาวร",
      cancelLabel: "ยกเลิก",
      icon: "assets/score.png",
    });
    if (!confirmed) return;
    try {
      await applyRentalChange({ username, permanent: true });
      setStatus(listStatus, "ตั้งถาวรแล้ว: " + name, "ok");
      paintReceipt(["ตั้งถาวร", "User: " + name, "สถานะ: ถาวร"]);
      await loadUsers();
    } catch (err) {
      setStatus(listStatus, err.message || String(err), "err");
    }
  }

  /* ---- Events ---- */
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.getAttribute("data-view")));
  });

  $("mode-day")?.addEventListener("click", () => setMode("day"));
  $("mode-web")?.addEventListener("click", () => setMode("web"));

  $("users-body")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const row = btn.closest("[data-user-id]");
    if (!row) return;
    const action = btn.getAttribute("data-action");
    if (action === "delete-user") deleteUser(row);
    if (action === "ban-user") banUser(row);
    if (action === "unban-user") unbanUser(row);
    if (action === "quick-extend") quickExtendUser(row);
    if (action === "make-permanent") makePermanentUser(row);
  });

  $("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("login-btn").disabled = true;
    setStatus($("login-status"), "กำลังเข้าสู่ระบบ…", "muted");
    try {
      await ensureApiReady();
      const data = await api("/api/auth/login", {
        method: "POST",
        body: {
          username: $("login-user").value.trim(),
          password: $("login-pass").value,
        },
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

  $("logout-btn")?.addEventListener("click", async () => {
    await sb.auth.signOut();
    accessToken = null;
    persistSessionToken(null);
    showLogin();
    setStatus($("login-status"), "ออกจากระบบแล้ว", "muted");
  });

  $("logout-btn-mobile")?.addEventListener("click", () => {
    $("logout-btn")?.click();
  });

  $("refresh-btn")?.addEventListener("click", () => loadUsers());
  $("refresh-stuck-btn")?.addEventListener("click", () => loadStuckTopups());
  $("refresh-audit-btn")?.addEventListener("click", () => loadAudit());
  $("refresh-stats-btn")?.addEventListener("click", () => loadStats());

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
      setStatus($("settings-status"), "บันทึกแล้ว", "ok");
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
      body: "ยืนยันเติมวันเช่าให้รายการค้างนี้",
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

  $("create-permanent")?.addEventListener("change", () => {
    if ($("create-permanent")?.checked) setFreeTrial("create", false);
    syncDurationVisibility("create");
  });
  $("extend-permanent")?.addEventListener("change", () => {
    if ($("extend-permanent")?.checked) setFreeTrial("extend", false);
    syncDurationVisibility("extend");
  });
  syncDurationVisibility("create");
  syncDurationVisibility("extend");

  document.querySelectorAll(".pack-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-pack-target") || "create";
      const permanentEl = $(target + "-permanent");

      if (btn.getAttribute("data-pack-permanent") === "1") {
        if (permanentEl) permanentEl.checked = true;
        setFreeTrial(target, false);
        syncDurationVisibility(target);
        return;
      }

      if (permanentEl) {
        permanentEl.checked = false;
        syncDurationVisibility(target);
      }

      const days = Math.max(0, Number(btn.getAttribute("data-pack-days")) || 0);
      const hours = Math.max(0, Number(btn.getAttribute("data-pack-hours")) || 0);
      const isTrial = btn.getAttribute("data-pack-free-trial") === "1";
      setFreeTrial(target, isTrial);

      if ($(target + "-days")) $(target + "-days").value = String(days);
      if ($(target + "-hours")) $(target + "-hours").value = String(hours || (isTrial ? 1 : 0));
      if ($(target + "-minutes")) $(target + "-minutes").value = "0";
    });
  });

  $("create-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("create-btn").disabled = true;
    setStatus($("create-status"), "กำลังสร้าง…", "muted");
    try {
      const username = $("create-user").value.trim();
      const password = $("create-pass").value;
      const permanent = !!$("create-permanent")?.checked;
      const duration = readDuration("create");
      const freeTrial = readFreeTrial("create");
      if (!permanent && !hasDuration(duration)) {
        throw new Error("ระบุวัน / ชม. / นาที หรือเลือกถาวร");
      }
      const data = await createAccount({
        username,
        password,
        permanent,
        duration,
        freeTrial,
      });
      const u = data.user || {};
      const st = rentalStatus(u);
      setStatus(
        $("create-status"),
        "สร้างแล้ว: " + (u.username || username) + " · " + st.label,
        "ok"
      );
      paintReceipt([
        "สร้างผู้ใช้",
        "User: " + (u.username || username),
        "สถานะ: " + st.label,
        (freeTrial ? "แพ็ก: ทดลอง 1 ชม." : "หมดอายุ: " + rentalReceiptExpiry(u)),
      ]);
      $("create-form").reset();
      if ($("create-days")) $("create-days").value = "1";
      if ($("create-hours")) $("create-hours").value = "0";
      if ($("create-minutes")) $("create-minutes").value = "0";
      setFreeTrial("create", false);
      syncDurationVisibility("create");
      await loadUsers();
    } catch (err) {
      setStatus($("create-status"), err.message || String(err), "err");
    } finally {
      $("create-btn").disabled = false;
    }
  });

  $("extend-lookup-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("extend-q").value.trim();
    const box = $("extend-result");
    if (box) {
      box.textContent = "กำลังค้นหา…";
      box.className = "lookup-box muted";
    }
    try {
      let row = null;
      if (adminMode === "day") {
        const { data, error } = await sb.rpc("admin_lookup_user", { p_query: q });
        if (!error && data?.ok) row = data;
      }
      if (!row) {
        const legacy = await api("/api/admin/lookup?q=" + encodeURIComponent(q));
        if (legacy?.ok) row = legacy;
        else throw new Error(legacy?.reason || "ไม่พบผู้ใช้");
      }
      row = enrichUser(row);
      if (box) {
        box.className = "lookup-box";
        box.innerHTML = describeRentalUser(row);
      }
      if ($("extend-q")) $("extend-q").value = row.username || q;
    } catch (err) {
      if (box) box.textContent = err.message || String(err);
    }
  });

  $("extend-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("extend-btn").disabled = true;
    setStatus($("extend-status"), "กำลังต่ออายุ…", "muted");
    try {
      const username = $("extend-q").value.trim();
      if (!username) throw new Error("ใส่ชื่อผู้ใช้ก่อน");
      const permanent = !!$("extend-permanent")?.checked;
      const duration = readDuration("extend");
      const freeTrial = readFreeTrial("extend");
      if (!permanent && !hasDuration(duration)) {
        throw new Error("ระบุวัน / ชม. / นาที หรือตั้งถาวร");
      }
      const data = await applyRentalChange(
        permanent
          ? { username, permanent: true }
          : { username, duration, freeTrial }
      );
      const u = enrichUser(data.user || { username });
      const st = rentalStatus(u);
      setStatus(
        $("extend-status"),
        (permanent ? "ตั้งถาวรแล้ว: " : "ต่ออายุแล้ว: ") +
          (u.username || username) +
          " · " +
          st.label,
        "ok"
      );
      paintReceipt([
        permanent ? "ตั้งถาวร" : freeTrial ? "ทดลอง 1 ชม." : "ต่ออายุ",
        "User: " + (u.username || username),
        "สถานะ: " + st.label,
        "หมดอายุ: " + rentalReceiptExpiry(u),
      ]);
      if ($("extend-result")) {
        $("extend-result").className = "lookup-box";
        $("extend-result").innerHTML = describeRentalUser(u);
      }
      setFreeTrial("extend", false);
      await loadUsers();
    } catch (err) {
      setStatus($("extend-status"), err.message || String(err), "err");
    } finally {
      $("extend-btn").disabled = false;
    }
  });

  $("revoke-btn")?.addEventListener("click", async () => {
    const username = $("extend-q").value.trim();
    if (!username) {
      setStatus($("extend-status"), "ใส่ชื่อผู้ใช้ก่อน", "err");
      return;
    }
    const confirmed = await showConfirmModal({
      title: "ตัดสิทธิ์ทันที?",
      body: 'ตัดสิทธิ์ "' + username + '" ทันที?',
      confirmLabel: "ตัดสิทธิ์",
      cancelLabel: "ยกเลิก",
      danger: true,
    });
    if (!confirmed) return;
    $("revoke-btn").disabled = true;
    try {
      const data = await applyRentalChange({ username, revoke: true });
      const u = data.user || { username };
      setStatus($("extend-status"), "ตัดสิทธิ์แล้ว: " + (u.username || username), "ok");
      paintReceipt(["ตัดสิทธิ์", "User: " + (u.username || username)]);
      await loadUsers();
    } catch (err) {
      setStatus($("extend-status"), err.message || String(err), "err");
    } finally {
      $("revoke-btn").disabled = false;
    }
  });

  $("set-expires-btn")?.addEventListener("click", async () => {
    const username = $("extend-q")?.value.trim();
    if (!username) {
      setStatus($("extend-status"), "ใส่ชื่อผู้ใช้ก่อน", "err");
      return;
    }
    $("set-expires-btn").disabled = true;
    setStatus($("extend-status"), "กำลังตั้งวันหมดอายุ…", "muted");
    try {
      const expiresAtIso = parseDatetimeLocal($("extend-expires-at")?.value);
      if (!expiresAtIso) throw new Error("เลือกวันและเวลาหมดอายุ");
      const data = await setRentalExpiresAt({ username, expiresAtIso });
      const u = enrichUser(data.user || { username });
      const st = rentalStatus(u);
      setStatus(
        $("extend-status"),
        "ตั้งหมดอายุแล้ว: " + (u.username || username) + " · " + st.label,
        "ok"
      );
      paintReceipt([
        "ตั้งวันหมดอายุ",
        "User: " + (u.username || username),
        "หมดอายุ: " + rentalReceiptExpiry(u),
      ]);
      if ($("extend-result")) {
        $("extend-result").className = "lookup-box";
        $("extend-result").innerHTML = describeRentalUser(u);
      }
      if ($("extend-permanent")) $("extend-permanent").checked = false;
      setFreeTrial("extend", false);
      syncDurationVisibility("extend");
      await loadUsers();
    } catch (err) {
      setStatus($("extend-status"), err.message || String(err), "err");
    } finally {
      $("set-expires-btn").disabled = false;
    }
  });

  $("quick-search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("quick-search").value.trim();
    if (!q) return;
    showView("cashier");
    if ($("extend-q")) $("extend-q").value = q;
    $("extend-lookup-form")?.requestSubmit();
  });

  sessionToken = loadStoredSessionToken();
  pingApiHealth(2).catch(() => {});
  initBgFloaters();

  (async () => {
    const ctx = await requireAdminSession();
    if (ctx) await showDash(ctx.profile);
  })();
})();
