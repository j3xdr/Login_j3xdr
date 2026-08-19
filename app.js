/* CKR Admin Console — POS dashboard (PC + Powder + Web rental days) */
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
  const REMEMBER_ME_KEY = "ckr_admin_remember_me";
  const MODE_KEY = "ckr_admin_mode";
  const DENSITY_KEY = "ckr_admin_density";
  const THEME_KEY = "ckr_admin_theme";
  const EDGE_ADMIN_FN = "admin-register";
  const USERS_PAGE = 100;
  const PREVIEW_MODE = (() => {
    try {
      const host = location.hostname;
      return (
        (host === "localhost" || host === "127.0.0.1") &&
        new URLSearchParams(location.search).get("preview") === "1"
      );
    } catch (_) {
      return false;
    }
  })();
  const PREVIEW_PROFILE = {
    id: "preview-admin",
    username: "preview-admin",
    display_name: "Preview Admin",
    role: "admin",
  };
  const PREVIEW_USERS = [
    {
      id: "preview-01",
      username: "alpha.demo",
      display_name: "Alpha Demo",
      role: "normal",
      is_permanent: false,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
      powder_is_permanent: false,
      powder_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
      rental_is_permanent: false,
      rental_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
      banned_at: null,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      invite_credit_balance: 14,
      token_balance: 86,
    },
    {
      id: "preview-02",
      username: "beta.permanent",
      display_name: "Beta Permanent",
      role: "normal",
      is_permanent: true,
      expires_at: null,
      powder_is_permanent: true,
      powder_expires_at: null,
      rental_is_permanent: true,
      rental_expires_at: null,
      banned_at: null,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      invite_credit_balance: 32,
      token_balance: 240,
    },
    {
      id: "preview-03",
      username: "gamma.expiring",
      display_name: "Gamma Expiring",
      role: "normal",
      is_permanent: false,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      powder_is_permanent: false,
      powder_expires_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      rental_is_permanent: false,
      rental_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(),
      banned_at: null,
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
      invite_credit_balance: 0,
      token_balance: 4,
    },
    {
      id: "preview-04",
      username: "delta.banned",
      display_name: "Delta Banned",
      role: "normal",
      is_permanent: false,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      powder_is_permanent: false,
      powder_expires_at: null,
      rental_is_permanent: false,
      rental_expires_at: null,
      banned_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      ban_reason: "ตรวจสอบการใช้งานผิดปกติ",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
      invite_credit_balance: 7,
      token_balance: 0,
    },
    {
      id: "preview-05",
      username: "epsilon.new",
      display_name: "Epsilon New",
      role: "normal",
      is_permanent: false,
      expires_at: null,
      powder_is_permanent: false,
      powder_expires_at: null,
      rental_is_permanent: false,
      rental_expires_at: null,
      banned_at: null,
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      invite_credit_balance: 21,
      token_balance: 18,
    },
  ];
  const PREVIEW_SETTINGS = {
    farm_maintenance: false,
    topup_maintenance: false,
    signup_closed: false,
    feature_locks: {
      partyrun: false,
      heart: false,
      powder: false,
      giftdraw: false,
      upgrade: false,
      cookie: false,
      afterplay_fast: false,
      unlock_l: true,
      ice_tower: false,
      friend: false,
      auto_redeem: true,
    },
    farm_feature_order: [
      "partyrun",
      "heart",
      "powder",
      "giftdraw",
      "upgrade",
      "cookie",
      "friend",
      "auto_redeem",
      "afterplay_fast",
      "unlock_l",
      "ice_tower",
    ],
    afterplay_fast_credit_per_run: 2,
    afterplay_fast_max_runs: 0,
    afterplay_episode_box_credit_per_run: 3,
    afterplay_episode_box_max_runs: 50,
    afterplay_episode_box_enabled: true,
    unlock_l_credit_each: 8,
    unlock_l_credit_bundle: 48,
    unlock_l_treasure_credit: 3,
    ice_tower_credit_each: 2,
    ice_tower_credit_bundle: 180,
    ice_tower_default_stars: 2,
    ice_tower_default_target_floor: 20,
    ice_tower_unlock_if_needed: true,
    ice_tower_allow_customer_star_map: true,
    friend_max_add: 300,
    auto_redeem_enabled: false,
    auto_redeem_max_codes: 8,
    auto_redeem_default_coupons: "Cookierunclassic2m,Cookierunclassic1m,COOKIERUNCLASSICNO1,AMAZINGKIWICOOK2",
    afterplay_profile_money_xp: {},
    afterplay_profile_episode_box: {},
  };
  const PREVIEW_STATS = {
    runs_total: 128,
    runs: { succeeded: 119, failed: 9 },
    topups: 26,
    topups_needs_manual: 2,
  };
  const PREVIEW_AUDIT = [
    { action: "admin_extend_rental", target_user_id: "preview-01", actor_id: "preview-admin", created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
    { action: "admin_credit_tokens", target_user_id: "preview-02", actor_id: "preview-admin", created_at: new Date(Date.now() - 1000 * 60 * 34).toISOString() },
    { action: "admin_ban_user", target_user_id: "preview-04", actor_id: "preview-admin", created_at: new Date(Date.now() - 1000 * 60 * 55).toISOString() },
    { action: "admin_create_user", target_user_id: "preview-05", actor_id: "preview-admin", created_at: new Date(Date.now() - 1000 * 60 * 75).toISOString() },
  ];
  const { createClient } = supabase;

  // Keep Supabase Auth in the same storage scope as the Remember me choice.
  // The default Supabase client persists sessions in localStorage, which would
  // make an unchecked Remember me box ineffective after a browser restart.
  function rememberMeEnabled() {
    try {
      return localStorage.getItem(REMEMBER_ME_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  const authStorage = {
    getItem(key) {
      try {
        if (rememberMeEnabled()) {
          return localStorage.getItem(key) || sessionStorage.getItem(key);
        }
        return sessionStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },
    setItem(key, value) {
      try {
        const persistent = rememberMeEnabled();
        const target = persistent ? localStorage : sessionStorage;
        const other = persistent ? sessionStorage : localStorage;
        target.setItem(key, value);
        other.removeItem(key);
      } catch (_) {}
    },
    removeItem(key) {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (_) {}
    },
  };

  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: authStorage,
    },
  });

  const $ = (id) => document.getElementById(id);

  const loginPanel = $("login-panel");
  const dash = $("dash");
  const modalRoot = $("modal-root");
  const modalTitle = $("modal-title");
  const modalBody = $("modal-body");
  const modalActions = $("modal-actions");
  const modalCard = modalRoot?.querySelector(".modal-card") || null;
  const cmdRoot = $("cmd-root");

  let accessToken = null;
  let sessionToken = null;
  let adminId = null;
  let apiReady = false;
  let heartHelpersTimer = null;
  let modalMode = null;
  let modalResolver = null;
  let adminMode = (() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === "web" || m === "token") return "web";
      if (m === "powder") return "powder";
      if (m === "invite") return "invite";
      return "day";
    } catch (_) {
      return "day";
    }
  })();
  let inviteCreditUser = null;
  let currentView = "overview";
  let cachedUsers = [];
  let monitorData = null;
  let monitorTimer = null;
  const monitorJobLogCache = new Map();
  const monitorJobLogLoading = new Set();
  let lastStats = null;
  let lastAudit = [];
  let stuckCount = 0;
  let settingsCache = {};
  let adminTopupPackages = [];
  const SETTINGS_SNAPSHOT_KEY = "ckr_admin_last_saved_settings";
  const SETTINGS_NUMERIC_FIELDS = [
    "afterplay_fast_credit_per_run",
    "afterplay_fast_max_runs",
    "unlock_l_credit_each",
    "unlock_l_credit_bundle",
    "unlock_l_treasure_credit",
    "ice_tower_credit_each",
    "ice_tower_credit_bundle",
    "ice_tower_default_stars",
    "ice_tower_default_target_floor",
    "friend_max_add",
    "auto_redeem_max_codes",
    "afterplay_episode_box_credit_per_run",
    "afterplay_episode_box_max_runs",
  ];
  const SETTINGS_DEFAULTS = {
    afterplay_fast_credit_per_run: 2,
    afterplay_fast_max_runs: 0,
    afterplay_episode_box_credit_per_run: 3,
    afterplay_episode_box_max_runs: 50,
  };
  const SETTINGS_INPUTS = {
    afterplay_fast_credit_per_run: "set-afterplay-fast-price",
    afterplay_fast_max_runs: "set-afterplay-fast-max-runs",
    unlock_l_credit_each: "set-unlock-l-each",
    unlock_l_credit_bundle: "set-unlock-l-bundle",
    unlock_l_treasure_credit: "set-unlock-l-treasure",
    ice_tower_credit_each: "set-ice-tower-each",
    ice_tower_credit_bundle: "set-ice-tower-bundle",
    ice_tower_default_stars: "set-ice-tower-default-stars",
    ice_tower_default_target_floor: "set-ice-tower-default-floor",
    friend_max_add: "set-friend-max-add",
    auto_redeem_max_codes: "set-auto-redeem-max-codes",
    afterplay_episode_box_credit_per_run: "set-episode-box-price",
    afterplay_episode_box_max_runs: "set-episode-box-max-runs",
  };
  const SETTINGS_BOOLEAN_INPUTS = {
    farm_maintenance: "set-farm-maint",
    topup_maintenance: "set-topup-maint",
    signup_closed: "set-signup-closed",
    ice_tower_unlock_if_needed: "set-ice-tower-unlock",
    ice_tower_allow_customer_star_map: "set-ice-tower-allow-map",
    auto_redeem_enabled: "set-auto-redeem-enabled",
    afterplay_episode_box_enabled: "set-episode-box-enabled",
  };
  const SETTINGS_NUMBER_RULES = {
    afterplay_fast_credit_per_run: { min: 0, max: 1000 },
    afterplay_fast_max_runs: { min: 0, max: 100000, integer: true },
    unlock_l_credit_each: { min: 0, max: 10000 },
    unlock_l_credit_bundle: { min: 0, max: 10000 },
    unlock_l_treasure_credit: { min: 0, max: 10000 },
    ice_tower_credit_each: { min: 0, max: 10000 },
    ice_tower_credit_bundle: { min: 0, max: 10000 },
    ice_tower_default_stars: { min: 1, max: 3, integer: true },
    ice_tower_default_target_floor: { min: 1, max: 100, integer: true },
    friend_max_add: { min: 1, max: 300, integer: true },
    auto_redeem_max_codes: { min: 1, max: 8, integer: true },
    afterplay_episode_box_credit_per_run: { min: 0, max: 1000 },
    afterplay_episode_box_max_runs: { min: 0, max: 100000, integer: true },
  };

  function readSettingsSnapshot() {
    try {
      const raw = localStorage.getItem(SETTINGS_SNAPSHOT_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function persistSettingsSnapshot(data) {
    try {
      const snapshot = {};
      const keys = [
        ...SETTINGS_NUMERIC_FIELDS,
        ...Object.keys(SETTINGS_BOOLEAN_INPUTS),
        "feature_locks",
        "farm_feature_order",
        "afterplay_profile_money_xp",
        "afterplay_profile_episode_box",
        "auto_redeem_default_coupons",
      ];
      keys.forEach((key) => {
        if (data && data[key] !== null && data[key] !== undefined) snapshot[key] = data[key];
      });
      snapshot.saved_at = new Date().toISOString();
      localStorage.setItem(SETTINGS_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch (_) {}
  }

  function normalizeSettings(data, fallback) {
    const result = {};
    [readSettingsSnapshot(), fallback || {}, data || {}].forEach((source) => {
      Object.keys(source || {}).forEach((key) => {
        const value = source[key];
        if (value !== null && value !== undefined && value !== "") result[key] = value;
      });
    });
    SETTINGS_NUMERIC_FIELDS.forEach((key) => {
      if (result[key] === undefined && SETTINGS_DEFAULTS[key] !== undefined) {
        result[key] = SETTINGS_DEFAULTS[key];
      }
    });
    return result;
  }

  function readNumberSetting(key, currentValue) {
    const id = SETTINGS_INPUTS[key];
    const rule = SETTINGS_NUMBER_RULES[key] || {};
    const raw = id ? $(id)?.value : undefined;
    let value = raw !== undefined && String(raw).trim() !== "" ? Number(raw) : Number(currentValue);
    if (!Number.isFinite(value)) value = Number(SETTINGS_DEFAULTS[key]);
    if (!Number.isFinite(value)) return undefined;
    if (rule.integer) value = Math.floor(value);
    if (Number.isFinite(rule.min)) value = Math.max(rule.min, value);
    if (Number.isFinite(rule.max)) value = Math.min(rule.max, value);
    return value;
  }

  function readSettingsPayloadFromUi() {
    const payload = {
      farm_maintenance: !!$(SETTINGS_BOOLEAN_INPUTS.farm_maintenance)?.checked,
      topup_maintenance: !!$(SETTINGS_BOOLEAN_INPUTS.topup_maintenance)?.checked,
      signup_closed: !!$(SETTINGS_BOOLEAN_INPUTS.signup_closed)?.checked,
      feature_locks: readFeatureLocksFromUi(),
      farm_feature_order: readFeatureOrderFromUi(),
      feature_catalog: readFeatureCatalogFromUi(),
      ice_tower_unlock_if_needed: !!$(SETTINGS_BOOLEAN_INPUTS.ice_tower_unlock_if_needed)?.checked,
    ice_tower_allow_customer_star_map: !!$(SETTINGS_BOOLEAN_INPUTS.ice_tower_allow_customer_star_map)?.checked,
    auto_redeem_enabled: !!$(SETTINGS_BOOLEAN_INPUTS.auto_redeem_enabled)?.checked,
    afterplay_episode_box_enabled: !!$(SETTINGS_BOOLEAN_INPUTS.afterplay_episode_box_enabled)?.checked,
  };
    SETTINGS_NUMERIC_FIELDS.forEach((key) => {
      const value = readNumberSetting(key, settingsCache[key]);
      if (value !== undefined) payload[key] = value;
    });
    const coupons = $("set-auto-redeem-coupons")?.value;
    if (coupons != null) payload.auto_redeem_default_coupons = String(coupons).trim();
    return { ...payload, ...readAfterplayProfilesFromUi() };
  }

  function paintSettingsControls(data) {
    Object.entries(SETTINGS_BOOLEAN_INPUTS).forEach(([key, id]) => {
      const input = $(id);
      if (input && data[key] !== undefined) input.checked = !!data[key];
    });
    Object.entries(SETTINGS_INPUTS).forEach(([key, id]) => {
      const input = $(id);
      if (input && data[key] !== undefined) input.value = data[key];
    });
    if ($("set-auto-redeem-coupons") && data.auto_redeem_default_coupons != null) {
      const raw = data.auto_redeem_default_coupons;
      $("set-auto-redeem-coupons").value = Array.isArray(raw) ? raw.join(",") : String(raw);
    }
    const savedAt = $("settings-saved-at");
    const stamp = readSettingsSnapshot().saved_at || data.saved_at;
    if (savedAt && stamp) {
      const date = new Date(stamp);
      savedAt.textContent = Number.isNaN(date.getTime())
        ? "ค่าจะยึดตามการบันทึกล่าสุด"
        : "บันทึกล่าสุด " + date.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
    }
  }
  const FEATURE_LOCK_KEYS = [
    "partyrun",
    "heart",
    "powder",
    "giftdraw",
    "upgrade",
    "cookie",
    "afterplay_fast",
    "unlock_l",
    "ice_tower",
    "friend",
    "auto_redeem",
  ];
  const FEATURE_LOCK_LABELS = {
    partyrun: "Party Run",
    heart: "ฟาร์มหัวใจ",
    powder: "ฟาร์มผง",
    giftdraw: "Gift Draw",
    upgrade: "ตีบวกสมบัติ",
    cookie: "ปลดล็อกคุกกี้",
    afterplay_fast: "ฟาร์มเงิน/XP",
    unlock_l: "ปลดล็อค L",
    ice_tower: "Ice Tower",
    friend: "เพื่อน (ทดสอบ)",
    auto_redeem: "Auto Redeem (ทดสอบ)",
  };
  const DEFAULT_FEATURE_ICONS = {
    partyrun: "pirate_cookie_run.gif",
    heart: "Heart.png",
    powder: "magic_powder.png",
    giftdraw: "icon_giftpoint.png",
    upgrade: "Crystal_Pearl_Earring_2B9.png",
    cookie: "pine_monk_cookie.png",
    afterplay_fast: "Cookie0023_head.png",
    unlock_l: "Tiger_Lily_Cookie.png",
    ice_tower: "ice_tower.png",
    friend: "Angel_cookie.png",
    auto_redeem: "gem.png",
  };
  const SHOP_ASSET_BASE = "https://crgwwdc.shop/assets/";
  const DEFAULT_FARM_FEATURE_ORDER = [
    "partyrun",
    "heart",
    "powder",
    "giftdraw",
    "upgrade",
    "cookie",
    "friend",
    "auto_redeem",
    "afterplay_fast",
    "unlock_l",
    "ice_tower",
  ];
  const FEATURE_LOCK_KEY_SET = new Set(FEATURE_LOCK_KEYS);
  let featureOrderState = DEFAULT_FARM_FEATURE_ORDER.slice();
  let featureCatalogState = {};
  let earlyAccessCache = {};
  let earlyAccessSelectReady = false;
  let userFilter = "all";
  let userSort = "created_desc";
  let userSearch = "";
  let drawerUserId = null;
  let cashierTab = "create";
  let usersVisibleLimit = USERS_PAGE;
  let overlayStack = [];
  let overlayCloseTimers = new WeakMap();
  let gPending = false;
  let gTimer = null;
  let cmdActiveIndex = 0;
  let cmdItems = [];

  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "status " + (kind || "muted");
    if (text && (kind === "ok" || kind === "err")) {
      toast(text, kind === "ok" ? "ok" : "err");
    }
  }

  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function setBtnLoading(btn, on) {
    if (!btn) return;
    if (on) {
      if (!btn.dataset.w) btn.dataset.w = btn.style.width || btn.offsetWidth + "px";
      btn.style.width = btn.dataset.w;
      btn.classList.add("is-loading");
      btn.disabled = true;
    } else {
      btn.classList.remove("is-loading");
      btn.disabled = false;
      btn.style.width = "";
      delete btn.dataset.w;
    }
  }

  function toast(message, kind) {
    const root = $("toast-root");
    if (!root || !message) return;
    const el = document.createElement("div");
    el.className = "toast is-" + (kind || "ok");
    el.innerHTML =
      '<div class="toast-msg">' +
      escapeHtml(message) +
      '</div><button type="button" class="toast-close" aria-label="ปิด">×</button>';
    const close = () => {
      el.remove();
    };
    el.querySelector(".toast-close")?.addEventListener("click", close);
    root.appendChild(el);
    setTimeout(close, 3500);
  }

  function skeletonHtml(kind) {
    if (kind === "table") {
      return Array.from({ length: 5 })
        .map(
          () =>
            '<tr><td colspan="5"><div class="skeleton skeleton-line"></div></td></tr>'
        )
        .join("");
    }
    if (kind === "cards") {
      return Array.from({ length: 4 })
        .map(() => '<div class="skeleton skeleton-card"></div>')
        .join("");
    }
    if (kind === "stats") {
      return Array.from({ length: 4 })
        .map(
          () =>
            '<div class="mini-stat"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line" style="width:40%"></div></div>'
        )
        .join("");
    }
    return Array.from({ length: 4 })
      .map(
        () =>
          '<div class="activity-row"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line" style="width:55%"></div></div>'
      )
      .join("");
  }

  /* ---- Overlay controller ---- */
  const FOCUSABLE =
    'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

  function syncBodyLock() {
    if (overlayStack.length) {
      document.documentElement.style.setProperty(
        "--scrollbar-pad",
        window.innerWidth - document.documentElement.clientWidth + "px"
      );
      document.body.classList.add("is-locked");
    } else {
      document.body.classList.remove("is-locked");
      document.documentElement.style.setProperty("--scrollbar-pad", "0px");
    }
  }

  function openOverlay(el, { onClose, initialFocus } = {}) {
    if (!el) return;
    const pending = overlayCloseTimers.get(el);
    if (pending) {
      clearTimeout(pending);
      overlayCloseTimers.delete(el);
    }
    const restoreTo = document.activeElement;
    if (!overlayStack.some((x) => x.el === el)) {
      overlayStack.push({ el, onClose, restoreTo });
    }
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => el.classList.add("is-open"));
    syncBodyLock();
    const focusEl =
      initialFocus ||
      el.querySelector("[autofocus]") ||
      el.querySelector(FOCUSABLE);
    setTimeout(() => focusEl?.focus?.(), 30);
  }

  function closeOverlay(el) {
    if (!el) return;
    const idx = overlayStack.findIndex((x) => x.el === el);
    const entry = idx >= 0 ? overlayStack.splice(idx, 1)[0] : null;
    el.classList.remove("is-open");
    const prev = overlayCloseTimers.get(el);
    if (prev) clearTimeout(prev);
    const finish = () => {
      overlayCloseTimers.delete(el);
      if (overlayStack.some((x) => x.el === el)) return;
      el.classList.add("hidden");
      el.setAttribute("aria-hidden", "true");
      syncBodyLock();
      if (entry?.restoreTo && typeof entry.restoreTo.focus === "function") {
        try {
          entry.restoreTo.focus();
        } catch (_) {}
      }
    };
    overlayCloseTimers.set(el, setTimeout(finish, 200));
    if (typeof entry?.onClose === "function") entry.onClose();
  }

  function closeTopOverlay() {
    const top = overlayStack[overlayStack.length - 1];
    if (!top) return false;
    if (top.el === modalRoot) {
      if (modalMode === "prompt") closeModalAndSettle(null);
      else if (modalMode === "confirm") closeModalAndSettle(false);
      else closeModalAndSettle(true);
      return true;
    }
    if (top.el === $("user-drawer")) {
      closeUserDrawer();
      return true;
    }
    if (top.el === cmdRoot) {
      closeCommandPalette();
      return true;
    }
    closeOverlay(top.el);
    return true;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (closeTopOverlay()) {
        e.preventDefault();
        return;
      }
    }

    const top = overlayStack[overlayStack.length - 1];
    if (top && e.key === "Tab") {
      const nodes = [...top.el.querySelectorAll(FOCUSABLE)].filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    if (top && top.el === cmdRoot) {
      handleCmdKeydown(e);
      return;
    }

    const tag = (e.target?.tagName || "").toLowerCase();
    const typing =
      tag === "input" ||
      tag === "textarea" ||
      tag === "select" ||
      e.target?.isContentEditable;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    if (typing || overlayStack.length) return;

    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      showView("users");
      $("users-search")?.focus();
      return;
    }

    if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
      gPending = true;
      clearTimeout(gTimer);
      gTimer = setTimeout(() => {
        gPending = false;
      }, 800);
      return;
    }

    if (gPending) {
      const map = { o: "overview", u: "users", m: "monitor", c: "cashier", s: "system" };
      const view = map[e.key.toLowerCase()];
      if (view) {
        e.preventDefault();
        showView(view);
      }
      gPending = false;
      clearTimeout(gTimer);
    }
  });

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
    if (state === "ready" || state === "down") paintOverviewAlerts();
  }

  async function pingApiHealth(retries) {
    if (PREVIEW_MODE) {
      apiReady = true;
      paintApiStatus("ready", "LOCAL PREVIEW");
      return true;
    }
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
    const closeBtn = $("modal-close");
    if (closeBtn) closeBtn.classList.toggle("hidden", !!locked);
    openOverlay(modalRoot);
  }

  function forceCloseModal() {
    modalMode = null;
    clearModalActions();
    closeOverlay(modalRoot);
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

  modalRoot?.querySelector(".modal-backdrop")?.addEventListener("click", () => {
    if (modalMode === "prompt") closeModalAndSettle(null);
    else if (modalMode === "confirm") closeModalAndSettle(false);
    else closeModalAndSettle(true);
  });

  /* ---- Session / API ---- */
  function setRememberMePreference(enabled) {
    try {
      localStorage.setItem(REMEMBER_ME_KEY, enabled ? "1" : "0");
    } catch (_) {}
  }

  function syncRememberMeControl() {
    const control = $("remember-me");
    if (control) control.checked = rememberMeEnabled();
  }

  function loadStoredSessionToken() {
    try {
      if (rememberMeEnabled()) {
        return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      }
      return sessionStorage.getItem(SESSION_KEY);
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
        const persistent = rememberMeEnabled();
        const target = persistent ? localStorage : sessionStorage;
        const other = persistent ? sessionStorage : localStorage;
        target.setItem(SESSION_KEY, token);
        other.removeItem(SESSION_KEY);
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

  function isEdgeRentalMode() {
    return adminMode === "day" || adminMode === "powder";
  }

  function rentalProduct() {
    return adminMode === "powder" ? "powder" : "pc";
  }

  function expiryAtForProduct(u, product) {
    if (!u) return null;
    if (product === "web") return u.rental_expires_at ?? null;
    if (product === "powder") return u.powder_expires_at ?? null;
    return u.expires_at ?? null;
  }

  function isPermanentForProduct(u, product) {
    if (!u) return false;
    if (product === "web") return !!u.rental_is_permanent;
    if (product === "powder") return !!u.powder_is_permanent;
    return !!u.is_permanent;
  }

  function expiryAt(u) {
    if (adminMode === "web") return expiryAtForProduct(u, "web");
    if (adminMode === "powder") return expiryAtForProduct(u, "powder");
    return expiryAtForProduct(u, "pc");
  }

  function isPermanent(u) {
    if (adminMode === "web") return isPermanentForProduct(u, "web");
    if (adminMode === "powder") return isPermanentForProduct(u, "powder");
    return isPermanentForProduct(u, "pc");
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
    if (isPermanent(u)) {
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

  function formatProductExpiry(u, product) {
    if (isPermanentForProduct(u, product)) return "ถาวร";
    const exp = expiryAtForProduct(u, product);
    return exp ? formatDay(exp) : "—";
  }

  function otherProductHints(u) {
    const hints = [];
    if (adminMode !== "day") {
      const exp = expiryAtForProduct(u, "pc");
      const perm = isPermanentForProduct(u, "pc");
      if (perm || exp) hints.push("PC: " + formatProductExpiry(u, "pc"));
    }
    if (adminMode !== "powder") {
      const exp = expiryAtForProduct(u, "powder");
      const perm = isPermanentForProduct(u, "powder");
      if (perm || exp) hints.push("Powder: " + formatProductExpiry(u, "powder"));
    }
    if (adminMode !== "web") {
      const exp = expiryAtForProduct(u, "web");
      const perm = isPermanentForProduct(u, "web");
      if (perm || exp) hints.push("Web: " + formatProductExpiry(u, "web"));
    }
    return hints.length
      ? ' <span class="muted">(' + escapeHtml(hints.join(" · ")) + ")</span>"
      : "";
  }

  function describeRentalUser(u) {
    const st = rentalStatus(u);
    const credit =
      u && u.invite_credit_balance != null
        ? " · Invite: " + Number(u.invite_credit_balance || 0) + " Credit"
        : "";
    return (
      "<strong>" +
      escapeHtml(u.username || "—") +
      "</strong> · " +
      escapeHtml(st.label) +
      (st.detail && st.detail !== "—"
        ? ' <span class="muted">(' + escapeHtml(st.detail) + ")</span>"
        : "") +
      otherProductHints(u) +
      escapeHtml(credit) +
      " · บทบาท: " +
      escapeHtml(u.role || "normal")
    );
  }

  function describeInviteCreditUser(u) {
    const bal = Number(u?.invite_credit_balance || 0) || 0;
    return (
      "<strong>" +
      escapeHtml(u?.username || "—") +
      "</strong> · Invite Credit: <strong>" +
      bal +
      "</strong>" +
      " · บทบาท: " +
      escapeHtml(u?.role || "normal")
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
    if (PREVIEW_MODE) {
      throw new Error("Local Preview mode — การกระทำจริงถูกปิดไว้");
    }
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

  async function apiUpload(path, formData) {
    if (PREVIEW_MODE) {
      throw new Error("Local Preview mode — การกระทำจริงถูกปิดไว้");
    }
    const headers = {};
    if (accessToken) headers.Authorization = "Bearer " + accessToken;
    if (sessionToken) headers["X-Session-Token"] = sessionToken;
    const res = await fetch(API + path, {
      method: "POST",
      headers,
      body: formData,
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
      const err = new Error(detail);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function resolveFeatureIconUrl(icon) {
    const raw = String(icon || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("/api/")) return API + raw;
    const file = raw.replace(/^assets\//, "").split("?")[0];
    return SHOP_ASSET_BASE + encodeURIComponent(file).replace(/%2F/gi, "/");
  }

  function normalizeFeatureCatalog(raw) {
    const out = {};
    FEATURE_LOCK_KEYS.forEach((key) => {
      out[key] = {
        label: FEATURE_LOCK_LABELS[key] || key,
        icon: DEFAULT_FEATURE_ICONS[key] || "",
      };
    });
    if (!raw || typeof raw !== "object") return out;
    FEATURE_LOCK_KEYS.forEach((key) => {
      const item = raw[key];
      if (!item || typeof item !== "object") return;
      const label = String(item.label || "").trim();
      if (label && label.length <= 40) out[key].label = label;
      const icon = String(item.icon || "").trim();
      if (icon) out[key].icon = icon;
    });
    return out;
  }

  function readFeatureCatalogFromUi() {
    const out = normalizeFeatureCatalog(featureCatalogState);
    document.querySelectorAll("#feature-order-list [data-feature-label]").forEach((el) => {
      const key = el.getAttribute("data-feature-label");
      if (!key || !out[key]) return;
      const label = String(el.value || "").trim();
      if (label && label.length <= 40) out[key].label = label;
    });
    return out;
  }

  async function applyRentalChange({
    username,
    userId,
    permanent,
    unsetPermanent,
    duration,
    revoke,
    freeTrial,
  }) {
    if (isEdgeRentalMode()) {
      if (revoke) {
        return invokeAdminRental({ action: "revoke", username });
      }
      if (unsetPermanent) {
        return invokeAdminRental({ action: "clear_permanent", username });
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
          rental_is_permanent: false,
          ...out,
        },
      };
    }

    if (unsetPermanent) {
      const out = await api("/api/admin/rental/set-permanent", {
        method: "POST",
        body: { user_id: uid, permanent: false },
      });
      return {
        user: {
          id: uid,
          username,
          rental_is_permanent: false,
          rental_expires_at: out.rental_expires_at ?? null,
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
          rental_is_permanent: true,
          rental_expires_at: out.rental_expires_at ?? null,
        },
      };
    }

    const body = {
      user_id: uid,
      reason: freeTrial ? "free_trial" : "admin_grant",
    };
    const days = Math.max(0, Math.floor(Number(duration?.days) || 0));
    const hours = Math.max(0, Math.floor(Number(duration?.hours) || 0));
    const minutes = Math.max(0, Math.floor(Number(duration?.minutes) || 0));
    if (days < 1 && hours < 1 && minutes < 1) {
      throw new Error("ต้องระบุอย่างน้อย 1 นาที / 1 ชม. / 1 วัน");
    }
    if (days > 0) body.days = days;
    if (hours > 0) body.hours = hours;
    if (minutes > 0) body.minutes = minutes;

    const out = await api("/api/admin/rental/grant", { method: "POST", body });
    return {
      user: {
        id: uid,
        username,
        rental_expires_at: out.rental_expires_at,
        rental_is_permanent: !!out.rental_is_permanent,
      },
    };
  }

  async function setRentalExpiresAt({ username, userId, expiresAtIso }) {
    if (!expiresAtIso) throw new Error("expires_at_required");

    if (isEdgeRentalMode()) {
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
        rental_is_permanent: false,
      },
    };
  }

  async function createAccount({ username, password, permanent, duration, freeTrial }) {
    if (isEdgeRentalMode()) {
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
      rental_is_permanent: false,
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

  function formatExpiryCell(u) {
    if (isPermanent(u)) return "ถาวร";
    const exp = expiryAt(u);
    return exp ? formatDay(exp) : "—";
  }

  function bkkDayBounds(offsetDays) {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(
      new Date(now.getTime() + offsetDays * 86400000)
    );
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    const start = new Date(`${y}-${m}-${d}T00:00:00+07:00`);
    const end = new Date(start.getTime() + 86400000);
    return { start: start.getTime(), end: end.getTime() };
  }

  function isExpiringIn(u, offsetDays) {
    if (isPermanent(u) || u.banned_at) return false;
    const exp = expiryAt(u);
    if (!exp) return false;
    const t = new Date(exp).getTime();
    if (Number.isNaN(t) || t <= Date.now()) return false;
    const { start, end } = bkkDayBounds(offsetDays);
    return t >= start && t < end;
  }

  function countExpiring(offsetDays) {
    return cachedUsers.filter((u) => isExpiringIn(u, offsetDays)).length;
  }

  function matchesUserFilter(u) {
    const st = rentalStatus(u);
    if (userFilter === "all") return true;
    if (userFilter === "banned") return st.kind === "banned";
    if (userFilter === "permanent") return st.kind === "permanent";
    if (userFilter === "active") return st.kind === "active";
    if (userFilter === "expired") return st.kind === "expired";
    if (userFilter === "unset") return st.kind === "unset";
    return true;
  }

  function matchesUserSearch(u) {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return String(u.username || "").toLowerCase().includes(q);
  }

  function sortUsers(list) {
    const arr = list.slice();
    const expTs = (u) => {
      const e = expiryAt(u);
      return e ? new Date(e).getTime() : isPermanent(u) ? Infinity : 0;
    };
    const createdTs = (u) =>
      u.created_at ? new Date(u.created_at).getTime() : 0;
    arr.sort((a, b) => {
      switch (userSort) {
        case "created_asc":
          return createdTs(a) - createdTs(b);
        case "expires_asc":
          return expTs(a) - expTs(b);
        case "expires_desc":
          return expTs(b) - expTs(a);
        case "name_asc":
          return String(a.username || "").localeCompare(String(b.username || ""));
        case "created_desc":
        default:
          return createdTs(b) - createdTs(a);
      }
    });
    return arr;
  }

  function getFilteredUsers() {
    return sortUsers(
      cachedUsers.filter((u) => matchesUserFilter(u) && matchesUserSearch(u))
    );
  }

  function getDisplayUsers() {
    return getFilteredUsers().slice(0, usersVisibleLimit);
  }

  function paintFilterCounts() {
    const counts = {
      all: cachedUsers.length,
      active: 0,
      permanent: 0,
      expired: 0,
      unset: 0,
      banned: 0,
    };
    cachedUsers.forEach((u) => {
      const k = rentalStatus(u).kind;
      if (counts[k] !== undefined) counts[k] += 1;
    });
    document.querySelectorAll("[data-count-for]").forEach((el) => {
      const key = el.getAttribute("data-count-for");
      el.textContent = String(counts[key] ?? 0);
    });
  }

  function syncSortHeaders() {
    const map = {
      created_desc: ["created", "descending"],
      created_asc: ["created", "ascending"],
      expires_asc: ["expires", "ascending"],
      expires_desc: ["expires", "descending"],
      name_asc: ["name", "ascending"],
    };
    const [key, dir] = map[userSort] || ["created", "descending"];
    document.querySelectorAll("#users-table th[data-sort-key]").forEach((th) => {
      const k = th.getAttribute("data-sort-key");
      th.setAttribute("aria-sort", k === key ? dir : "none");
    });
    if ($("users-sort") && $("users-sort").value !== userSort) {
      $("users-sort").value = userSort;
    }
  }

  function animateKpi(el, value) {
    if (!el) return;
    const next = String(value);
    if (el.textContent === next) return;
    el.textContent = next;
    el.animate?.(
      [{ opacity: 0.45, transform: "translateY(2px)" }, { opacity: 1, transform: "none" }],
      { duration: 320, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
  }

  function emptyUsersHtml(desktop) {
    const hasFilter = userFilter !== "all" || !!userSearch;
    const msg = hasFilter
      ? "ไม่พบผู้ใช้ที่ตรงกับคำค้นหรือตัวกรอง"
      : "ยังไม่มีผู้ใช้ในโหมดนี้";
    const cta = hasFilter
      ? '<button type="button" class="btn btn-ghost btn-sm" data-action="clear-filters">ล้างตัวกรอง</button>'
      : '<button type="button" class="btn btn-primary btn-sm" data-action="goto-create">สร้างบัญชี</button>';
    if (desktop) {
      return (
        '<tr><td colspan="5"><div class="empty-state"><strong>' +
        msg +
        "</strong><p class=\"muted\">ลองเปลี่ยนตัวกรอง หรือสร้างบัญชีใหม่</p>" +
        cta +
        "</div></td></tr>"
      );
    }
    return (
      '<div class="empty-state"><strong>' +
      msg +
      '</strong><p class="muted">ลองเปลี่ยนตัวกรอง หรือสร้างบัญชีใหม่</p>' +
      cta +
      "</div>"
    );
  }

  function findUserById(id) {
    return cachedUsers.find((u) => u.id === id) || null;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      return false;
    }
  }

  function exportUsersCsv() {
    const rows = getFilteredUsers();
    const header = ["username", "created_at", "expires_at", "status", "role"];
    const lines = [header.join(",")];
    rows.forEach((u) => {
      const st = rentalStatus(u);
      lines.push(
        [
          u.username || "",
          u.created_at || "",
          expiryAt(u) || (isPermanent(u) ? "permanent" : ""),
          st.label,
          u.role || "normal",
        ]
          .map((v) => '"' + String(v).replace(/"/g, '""') + '"')
          .join(",")
      );
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ckr-users-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function showCashierTab(name) {
    cashierTab = name || "create";
    document.querySelectorAll("[data-cashier-tab]").forEach((btn) => {
      const on = btn.getAttribute("data-cashier-tab") === cashierTab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    ["create", "extend", "expires"].forEach((t) => {
      const el = $("cashier-tab-" + t);
      if (!el) return;
      const on = t === cashierTab;
      el.classList.toggle("is-active", on);
      el.hidden = !on;
    });
  }

  function openRentalTask(tab) {
    if (adminMode === "invite") setMode("day");
    showView("cashier");
    showCashierTab(tab || "create");
  }

  function paintOverviewAlerts() {
    const root = $("overview-alerts");
    if (!root) return;
    const alerts = [];
    if (!apiReady) {
      alerts.push({
        kind: "danger",
        text: "API ไม่พร้อม — ตรวจสอบเซิร์ฟเวอร์",
        action: null,
      });
    }
    if (settingsCache.farm_maintenance) {
      alerts.push({ kind: "warn", text: "ปิดฟาร์มอยู่", action: "system" });
    }
    if (settingsCache.topup_maintenance) {
      alerts.push({ kind: "warn", text: "ปิดเติมเงินอยู่", action: "system" });
    }
    if (settingsCache.signup_closed) {
      alerts.push({ kind: "warn", text: "ปิดสมัครผ่านเว็บอยู่", action: "system" });
    }
    const locks = settingsCache.feature_locks || {};
    const lockedNames = Object.keys(locks)
      .filter((k) => locks[k])
      .map((k) => FEATURE_LOCK_LABELS[k] || k);
    if (lockedNames.length) {
      alerts.push({
        kind: "warn",
        text: "ล็อกฟังก์ชัน: " + lockedNames.join(", "),
        action: "system",
      });
    }
    if (adminMode === "web" && stuckCount > 0) {
      alerts.push({
        kind: "danger",
        text: "เติมค้าง " + stuckCount + " รายการ",
        action: "stuck",
      });
    }
    const expToday = countExpiring(0);
    if (expToday > 0) {
      alerts.push({
        kind: "warn",
        text: "หมดอายุวันนี้ " + expToday + " คน",
        action: "users-expire",
      });
    }
    if (!alerts.length) {
      root.innerHTML =
        '<div class="alert-item is-ok"><span>ไม่มีรายการเร่งด่วน</span></div>';
      return;
    }
    root.innerHTML = alerts
      .map((a) => {
        const btn = a.action
          ? '<button type="button" class="btn btn-ghost btn-sm" data-alert-action="' +
            escapeHtml(a.action) +
            '">ดู</button>'
          : "";
        return (
          '<div class="alert-item is-' +
          a.kind +
          '"><span>' +
          escapeHtml(a.text) +
          "</span>" +
          btn +
          "</div>"
        );
      })
      .join("");
  }

  function paintRecentActivity() {
    const root = $("recent-activity");
    if (!root) return;
    const items = lastAudit.slice(0, 8);
    if (!items.length) {
      root.textContent = "ยังไม่มีบันทึก";
      root.className = "activity-list muted";
      return;
    }
    root.className = "activity-list";
    root.innerHTML = items
      .map(
        (row) =>
          '<div class="activity-row"><div class="activity-row-head"><strong>' +
          escapeHtml(row.action) +
          '</strong><span class="muted">' +
          escapeHtml(formatDay(row.created_at)) +
          "</span></div>" +
          '<div class="muted">' +
          escapeHtml(row.target_user_id || "—") +
          "</div></div>"
      )
      .join("");
  }

  function paintStatsCards() {
    const root = $("daily-stats-cards");
    if (!root || !lastStats) return;
    const runs = lastStats.runs || {};
    const cards = [
      { label: "ฟาร์มทั้งหมด", value: lastStats.runs_total || 0 },
      { label: "สำเร็จ", value: runs.succeeded || 0 },
      { label: "ล้มเหลว", value: runs.failed || 0 },
    ];
    if (adminMode === "web") {
      cards.push({ label: "เติมเงิน", value: lastStats.topups || 0 });
      cards.push({ label: "ตามมือ", value: lastStats.topups_needs_manual || 0 });
    }
    root.className = "mini-stat-grid";
    root.innerHTML = cards
      .map(
        (c) =>
          '<div class="mini-stat"><span>' +
          escapeHtml(c.label) +
          '</span><strong>' +
          escapeHtml(c.value) +
          "</strong></div>"
      )
      .join("");
  }

  function closeUserDrawer() {
    drawerUserId = null;
    const drawer = $("user-drawer");
    if (drawer) closeOverlay(drawer);
  }

  function bindDrawerSwipe(panel) {
    if (!panel || panel.dataset.swipeBound === "1") return;
    panel.dataset.swipeBound = "1";
    let startY = 0;
    let dragging = false;
    panel.addEventListener(
      "pointerdown",
      (e) => {
        if (window.innerWidth > 768) return;
        if (!e.target.closest(".drawer-handle, .drawer-head")) return;
        dragging = true;
        startY = e.clientY;
        panel.setPointerCapture?.(e.pointerId);
      },
      { passive: true }
    );
    panel.addEventListener(
      "pointermove",
      (e) => {
        if (!dragging) return;
        const dy = Math.max(0, e.clientY - startY);
        panel.style.transform = "translateY(" + dy + "px)";
      },
      { passive: true }
    );
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      const dy = Math.max(0, e.clientY - startY);
      panel.style.transform = "";
      if (dy > 80) closeUserDrawer();
    };
    panel.addEventListener("pointerup", end);
    panel.addEventListener("pointercancel", end);
  }

  async function openUserDrawer(userId) {
    const u = findUserById(userId);
    if (!u) return;
    drawerUserId = userId;
    const drawer = $("user-drawer");
    bindDrawerSwipe(drawer?.querySelector(".drawer-panel"));
    const st = rentalStatus(u);
    const body = $("drawer-body");
    const actions = $("drawer-actions");
    const title = $("drawer-title");
    if (title) title.textContent = u.username || "ผู้ใช้";
    if (body) {
      body.className = "drawer-body";
      body.innerHTML =
        '<dl class="drawer-meta">' +
        "<div><dt>ชื่อผู้ใช้</dt><dd><strong>" +
        escapeHtml(u.username || "—") +
        '</strong> <button type="button" class="copy-btn" data-copy="' +
        escapeHtml(u.username || "") +
        '">คัดลอก</button></dd></div>' +
        "<div><dt>สมัครเมื่อ</dt><dd>" +
        escapeHtml(formatDay(u.created_at)) +
        "</dd></div>" +
        "<div><dt>หมดอายุ</dt><dd>" +
        escapeHtml(formatExpiryCell(u)) +
        "</dd></div>" +
        "<div><dt>สถานะ</dt><dd><span class=\"tag tag-" +
        st.kind +
        '">' +
        escapeHtml(st.label) +
        "</span></dd></div>" +
        "<div><dt>บทบาท</dt><dd>" +
        escapeHtml(u.role || "normal") +
        "</dd></div>" +
        (u.invite_credit_balance != null
          ? "<div><dt>Invite Credit</dt><dd><strong>" +
            escapeHtml(String(u.invite_credit_balance)) +
            "</strong></dd></div>"
          : "") +
        (u.token_balance != null
          ? "<div><dt>Token</dt><dd>" + escapeHtml(String(u.token_balance)) + "</dd></div>"
          : "") +
        (u.ban_reason
          ? "<div><dt>เหตุผลแบน</dt><dd>" + escapeHtml(u.ban_reason) + "</dd></div>"
          : "") +
        '</dl><section id="drawer-jobs" class="drawer-history muted" aria-live="polite">กำลังโหลดประวัติงาน…</section><section id="drawer-topups" class="drawer-history muted">กำลังโหลดประวัติเติม…</section>';
    }
    if (actions) {
      const isSelf = adminId && u.id === adminId;
      const isAdmin = (u.role || "normal") === "admin";
      const canMutate = !isSelf && !isAdmin;
      actions.innerHTML = "";
      if (canMutate) {
        actions.appendChild(
          makeBtn("ต่ออายุ", "btn btn-primary btn-sm", () => {
            closeUserDrawer();
            openRentalTask("extend");
            if ($("extend-q")) $("extend-q").value = u.username || "";
            $("extend-lookup-form")?.requestSubmit();
          })
        );
        actions.appendChild(
          makeBtn("เติมเครดิต", "btn btn-ghost btn-sm", () => {
            closeUserDrawer();
            setMode("invite");
            showView("cashier");
            if ($("invite-credit-q")) $("invite-credit-q").value = u.username || "";
            $("invite-credit-lookup-form")?.requestSubmit();
          })
        );
        if (isPermanent(u)) {
          actions.appendChild(
            makeBtn("เอาถาวรออก", "btn btn-ghost btn-sm", () =>
              runDrawerAction(async () => {
                const ok = await showConfirmModal({
                  title: "เอาสิทธิ์ถาวรออก?",
                  body:
                    'ยกเลิกสิทธิ์ถาวรของ "' +
                    (u.username || "") +
                    '" (ยังคงวันหมดอายุเดิมถ้ามี)',
                  confirmLabel: "เอาถาวรออก",
                  cancelLabel: "ยกเลิก",
                });
                if (!ok) return false;
                await applyRentalChange({
                  username: u.username,
                  userId: u.id,
                  unsetPermanent: true,
                });
              })
            )
          );
        } else {
          actions.appendChild(
            makeBtn("ตั้งถาวร", "btn btn-ghost btn-sm", () =>
              runDrawerAction(async () => {
                const ok = await showConfirmModal({
                  title: "ตั้งถาวร?",
                  body: 'ตั้ง "' + (u.username || "") + '" เป็นบัญชีถาวร?',
                  confirmLabel: "ตั้งถาวร",
                  cancelLabel: "ยกเลิก",
                });
                if (!ok) return false;
                await applyRentalChange({
                  username: u.username,
                  userId: u.id,
                  permanent: true,
                });
              })
            )
          );
        }
        actions.appendChild(
          makeBtn(u.banned_at ? "ปลดแบน" : "แบน", "btn btn-ghost btn-sm", () =>
            u.banned_at ? runDrawerBan(false) : runDrawerBan(true)
          )
        );
        actions.appendChild(
          makeBtn("ลบ", "btn btn-danger btn-sm", () => runDrawerDelete())
        );
      }
    }
    if (drawer) openOverlay(drawer, { initialFocus: $("drawer-close") });
    if (u.id) loadDrawerJobs(u.id);
    if (adminMode === "web" && u.id) loadDrawerTopups(u.id);
    else {
      const tp = $("drawer-topups");
      if (tp) tp.textContent = "";
    }
  }

  async function loadDrawerTopups(userId) {
    const root = $("drawer-topups");
    if (!root) return;
    try {
      const data = await api("/api/admin/users/" + encodeURIComponent(userId) + "/topups");
      const items = data.items || [];
      if (!items.length) {
        root.textContent = "ยังไม่มีประวัติเติมเงิน";
        return;
      }
      root.innerHTML =
        "<strong style=\"font-size:0.85rem\">เติมล่าสุด</strong>" +
        items
          .map(
            (row) =>
              '<div class="activity-row" style="margin-top:6px">' +
              escapeHtml(row.days_credited || row.package_days || row.tokens_credited || "—") +
              " วัน · " +
              escapeHtml(formatDay(row.created_at)) +
              " · " +
              escapeHtml(row.credit_status || "") +
              "</div>"
          )
          .join("");
    } catch (e) {
      root.textContent = e.message || String(e);
    }
  }

  async function loadDrawerJobs(userId) {
    const root = $("drawer-jobs");
    if (!root) return;
    if (PREVIEW_MODE) {
      root.innerHTML = '<strong>ประวัติงาน <span class="muted">(2 งาน)</span></strong><div class="activity-row">heart · <span class="tag tag-active">กำลังทำ</span></div><div class="activity-row">partyrun · สำเร็จ</div>';
      return;
    }
    try {
      const data = await api("/api/admin/users/" + encodeURIComponent(userId) + "/jobs?limit=20");
      const items = data.items || [];
      if (!items.length) {
        root.innerHTML = "<strong>ประวัติงาน</strong><div>ยังไม่มีงานในระบบ</div>";
        return;
      }
      root.innerHTML =
        "<strong>ประวัติงาน <span class=\"muted\">(" + escapeHtml(String(data.total ?? items.length)) + " งาน)</span></strong>" +
        items.map((row) => '<div class="activity-row"><b>' + escapeHtml(row.kind || "งาน") + '</b> · <span class="monitor-status is-' + escapeHtml(row.status || "unknown") + '">' + escapeHtml(row.status || "—") + "</span><small>" + escapeHtml(formatMonitorTime(row.finished_at || row.started_at || row.created_at)) + "</small>" + (row.error ? '<small class="monitor-error">' + escapeHtml(row.error) + "</small>" : "") + monitorJobLogMarkup(row.job_id) + "</div>").join("");
    } catch (e) {
      root.textContent = "โหลดประวัติงานไม่สำเร็จ: " + (e.message || String(e));
    }
  }

  async function runDrawerAction(fn) {
    const u = findUserById(drawerUserId);
    if (!u) return;
    try {
      const done = await fn();
      if (done === false) return;
      await loadUsers();
      openUserDrawer(u.id);
      paintOverviewAlerts();
    } catch (e) {
      await showAlertModal({ title: "ไม่สำเร็จ", body: e.message, mode: "error" });
    }
  }

  async function runDrawerBan(ban) {
    const u = findUserById(drawerUserId);
    if (!u) return;
    if (ban) {
      const reason = await showPromptModal({
        title: "แบนผู้ใช้",
        body: 'เหตุผลแบน "' + (u.username || "") + '"',
        placeholder: "เหตุผล",
        defaultValue: "",
        confirmLabel: "แบน",
      });
      if (reason === null) return;
      await api("/api/admin/users/" + encodeURIComponent(u.id) + "/ban", {
        method: "POST",
        body: { reason: String(reason).trim() },
      });
    } else {
      await api("/api/admin/users/" + encodeURIComponent(u.id) + "/unban", {
        method: "POST",
        body: {},
      });
    }
    await loadUsers();
    openUserDrawer(u.id);
  }

  async function runDrawerDelete() {
    const u = findUserById(drawerUserId);
    if (!u) return;
    const ok = await showConfirmModal({
      title: "ลบผู้ใช้?",
      body: 'ลบ "' + (u.username || "") + '" ถาวร?',
      confirmLabel: "ลบ",
      danger: true,
    });
    if (!ok) return;
    await api("/api/admin/users/" + encodeURIComponent(u.id), { method: "DELETE" });
    closeUserDrawer();
    await loadUsers();
  }

  function getFilteredAudit() {
    const q = ($("audit-search")?.value || "").trim().toLowerCase();
    const f = $("audit-filter")?.value || "all";
    return lastAudit.filter((row) => {
      const action = String(row.action || "").toLowerCase();
      const target = String(row.target_user_id || "").toLowerCase();
      if (q && !action.includes(q) && !target.includes(q)) return false;
      if (f === "all") return true;
      if (f === "rental")
        return /rental|extend|permanent|expires|grant|revoke/i.test(action);
      if (f === "topup") return /topup|credit/i.test(action);
      if (f === "ban") return /ban|unban/i.test(action);
      if (f === "user") return /create|delete|user/i.test(action);
      return true;
    });
  }

  function paintAuditList() {
    const root = $("audit-list");
    if (!root) return;
    const items = getFilteredAudit();
    if (!items.length) {
      root.textContent = "ไม่พบรายการ";
      root.className = "admin-list muted";
      return;
    }
    root.className = "admin-list";
    root.innerHTML = items
      .map(
        (row) =>
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
      )
      .join("");
  }

  async function lookupUserToBox(q, boxId, inputId) {
    const box = $(boxId);
    if (box) {
      box.textContent = "กำลังค้นหา…";
      box.className = "lookup-box muted";
    }
    try {
      let row = null;
      if (isEdgeRentalMode()) {
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
      if (inputId && $(inputId)) $(inputId).value = row.username || q;
      return row;
    } catch (err) {
      if (box) box.textContent = err.message || String(err);
      throw err;
    }
  }

  async function invokeAdminRental(body) {
    if (PREVIEW_MODE) {
      throw new Error("Local Preview mode — การกระทำจริงถูกปิดไว้");
    }
    const { data, error } = await sb.functions.invoke(EDGE_ADMIN_FN, {
      body: { product: rentalProduct(), ...body },
    });
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
    if (mode === "web" || mode === "token") adminMode = "web";
    else if (mode === "powder") adminMode = "powder";
    else if (mode === "invite") adminMode = "invite";
    else adminMode = "day";
    try {
      localStorage.setItem(MODE_KEY, adminMode);
    } catch (_) {}
    dash?.classList.toggle("mode-day", adminMode === "day");
    dash?.classList.toggle("mode-powder", adminMode === "powder");
    dash?.classList.toggle("mode-web", adminMode === "web");
    dash?.classList.toggle("mode-invite", adminMode === "invite");
    $("mode-day")?.classList.toggle("is-active", adminMode === "day");
    $("mode-powder")?.classList.toggle("is-active", adminMode === "powder");
    $("mode-web")?.classList.toggle("is-active", adminMode === "web");
    $("mode-invite")?.classList.toggle("is-active", adminMode === "invite");
    const modeLabels = { day: "PC", powder: "Powder", web: "Web", invite: "Invite" };
    const fieldHints = {
      day: "expires_at (PC)",
      powder: "powder_expires_at (Powder)",
      web: "rental_expires_at (Web)",
      invite: "invite_credit_balance",
    };
    if ($("overview-mode-hint")) {
      $("overview-mode-hint").textContent =
        adminMode === "invite"
          ? "โหมด Invite · เพิ่ม/ลด Invite Credit · Guest Pool"
          : "โหมด " +
            modeLabels[adminMode] +
            " · ฟิลด์ " +
            fieldHints[adminMode] +
            " · ถาวรแยกกัน";
    }
    if ($("cashier-mode-hint")) {
      $("cashier-mode-hint").textContent =
        adminMode === "invite"
          ? "เพิ่ม / ลด Invite Credit"
          : "เปิดสิทธิ์วันใช้งาน (" + modeLabels[adminMode] + ")";
    }
    if ($("sidebar-mode-label")) {
      $("sidebar-mode-label").textContent = modeLabels[adminMode];
    }
    loadInvitePoolStats().catch(() => {});
    loadUsers();
    paintKpis();
    paintOverviewAlerts();
    paintStatsCards();
  }

  function showView(name) {
    currentView = name || "overview";
    document.querySelectorAll(".pos-view").forEach((el) => {
      el.classList.toggle("is-active", el.getAttribute("data-panel") === currentView);
    });
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === currentView);
    });
    if (currentView === "monitor") startMonitorPolling();
    else stopMonitorPolling();
  }

  function formatMonitorTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function monitorJobLogMarkup(jobId) {
    const id = String(jobId || "").trim();
    if (!id) return "";
    return '<details class="monitor-job-log"><summary data-monitor-job-log="' + escapeHtml(id) + '">ดู Log รายการนี้</summary><div class="monitor-log-body muted" data-monitor-log-body="' + escapeHtml(id) + '">เปิดเพื่อโหลด Log</div></details>';
  }

  function monitorJobLogTargets(jobId) {
    const id = String(jobId || "");
    return Array.from(document.querySelectorAll("[data-monitor-log-body]")).filter((el) => el.dataset.monitorLogBody === id);
  }

  function renderMonitorJobLog(jobId, html) {
    monitorJobLogTargets(jobId).forEach((el) => { el.innerHTML = html; });
  }

  function monitorJobLogContent(detail) {
    const logs = Array.isArray(detail?.logs) ? detail.logs.map((line) => String(line)) : [];
    const progress = detail?.progress && typeof detail.progress === "object" ? detail.progress : {};
    const progressBits = [];
    if (progress.phase) progressBits.push("ขั้นตอน: " + String(progress.phase));
    if (Number.isFinite(Number(progress.current)) || Number.isFinite(Number(progress.total))) {
      progressBits.push("ความคืบหน้า: " + String(progress.current || 0) + "/" + String(progress.total || 0));
    }
    const meta = [
      progressBits.length ? '<div class="monitor-log-meta">' + escapeHtml(progressBits.join(" · ")) + "</div>" : "",
      detail?.error ? '<div class="monitor-log-error">ข้อผิดพลาด: ' + escapeHtml(detail.error) + "</div>" : "",
    ].join("");
    if (!logs.length) return meta + '<p class="monitor-log-empty">งานนี้ยังไม่มี Log ที่บันทึกไว้</p>';
    return meta + '<ol class="monitor-log-lines">' + logs.map((line) => "<li>" + escapeHtml(line) + "</li>").join("") + "</ol>";
  }

  async function loadMonitorJobLog(jobId) {
    const id = String(jobId || "").trim();
    if (!id) return;
    const cached = monitorJobLogCache.get(id);
    if (cached) {
      renderMonitorJobLog(id, monitorJobLogContent(cached));
      return;
    }
    if (monitorJobLogLoading.has(id)) {
      renderMonitorJobLog(id, "กำลังโหลด Log…");
      return;
    }
    monitorJobLogLoading.add(id);
    renderMonitorJobLog(id, "กำลังโหลด Log…");
    try {
      const detail = PREVIEW_MODE
        ? { logs: ["[preview] เริ่มงาน", "[preview] Worker รับงานแล้ว", "[preview] งานกำลังดำเนินการ"], progress: { phase: "run", current: 2, total: 3 } }
        : await api("/api/admin/jobs/" + encodeURIComponent(id));
      monitorJobLogCache.set(id, detail || {});
      renderMonitorJobLog(id, monitorJobLogContent(detail || {}));
    } catch (e) {
      renderMonitorJobLog(id, '<span class="monitor-log-error">โหลด Log ไม่สำเร็จ: ' + escapeHtml(e.message || String(e)) + "</span>");
    } finally {
      monitorJobLogLoading.delete(id);
    }
  }

  function previewMonitorPayload() {
    const now = new Date();
    const iso = (mins) => new Date(now.getTime() - mins * 60000).toISOString();
    return {
      ok: true, generated_at: now.toISOString(), workers_alive: 3,
      totals: { queued: 2, running: 1, succeeded: 119, failed: 9, cancelled: 2 },
      workers: {
        heart: { label: "หัวใจ", alive: true, id: "heart-01", slots: 1, kinds: ["heart"], age_sec: 4, detail: "พร้อมใช้งาน" },
        powder: { label: "ผง", alive: true, id: "powder-01", slots: 1, kinds: ["powder"], age_sec: 8, detail: "พร้อมใช้งาน" },
        light: { label: "งานเบา", alive: true, id: "light-01", slots: 2, kinds: ["partyrun", "friend"], age_sec: 2, detail: "พร้อมใช้งาน" },
      },
      queue: [{ id: "q-1", user_id: "preview-03", username: "gamma.expiring", status: "waiting", job_kind: "heart", joined_at: iso(3) }],
      active_jobs: [{ job_id: "j-1", user_id: "preview-01", username: "alpha.demo", kind: "heart", status: "running", progress: { percent: 62 }, created_at: iso(8), started_at: iso(7), claimed_by: "heart-01" }],
      recent_jobs: [
        { job_id: "j-1", user_id: "preview-01", username: "alpha.demo", kind: "heart", status: "running", progress: { percent: 62 }, created_at: iso(8), started_at: iso(7) },
        { job_id: "j-2", user_id: "preview-02", username: "beta.permanent", kind: "partyrun", status: "succeeded", created_at: iso(20), finished_at: iso(11) },
        { job_id: "j-3", user_id: "preview-03", username: "gamma.expiring", kind: "powder", status: "failed", error: "หมดเวลาเชื่อมต่อ", created_at: iso(34), finished_at: iso(30) },
      ],
      users: [{ user_id: "preview-01", username: "alpha.demo", jobs: 4, queued: 1, running: 1, succeeded: 2, failed: 0, cancelled: 0, kinds: { heart: 3, partyrun: 1 } }, { user_id: "preview-02", username: "beta.permanent", jobs: 3, queued: 0, running: 0, succeeded: 3, failed: 0, cancelled: 0, kinds: { partyrun: 3 } }],
      activity_window: 3,
    };
  }

  function monitorSearchMatches(row, query) {
    if (!query) return true;
    return [row.username, row.user_id, row.kind, row.status, row.claimed_by, row.job_kind, row.id].some((value) => String(value || "").toLowerCase().includes(query));
  }

  function renderMonitor() {
    const data = monitorData;
    if (!data) return;
    const totals = data.totals || {};
    animateKpi($("monitor-workers-alive"), data.workers_alive ?? 0);
    animateKpi($("monitor-running"), totals.running ?? 0);
    animateKpi($("monitor-queued"), totals.queued ?? 0);
    animateKpi($("monitor-succeeded"), totals.succeeded ?? 0);
    animateKpi($("monitor-failed"), totals.failed ?? 0);
    if ($("monitor-updated-at")) $("monitor-updated-at").textContent = "อัปเดต " + formatMonitorTime(data.generated_at);
    const workers = Object.values(data.workers || {}).filter((worker) => worker && worker.role !== "heavy");
    const workersRoot = $("monitor-workers");
    if (workersRoot) workersRoot.innerHTML = workers.length ? workers.map((worker) => `<div class="monitor-row"><span class="monitor-dot ${worker.alive ? "is-live" : ""}"></span><div><b>${escapeHtml(worker.label || worker.role || "Worker")}</b><small>${escapeHtml(worker.id || "ยังไม่มีสัญญาณ")} · ${escapeHtml((worker.kinds || []).join(", ") || "—")}</small></div><span class="monitor-status ${worker.alive ? "is-running" : "is-failed"}">${escapeHtml(worker.detail || (worker.alive ? "พร้อม" : "ออฟไลน์"))}</span></div>`).join("") : "ไม่มีข้อมูล worker";
    const query = ($("monitor-search")?.value || "").trim().toLowerCase();
    const status = $("monitor-status-filter")?.value || "all";
    const queue = (data.queue || []).filter((row) => monitorSearchMatches(row, query));
    if ($("monitor-queue-count")) $("monitor-queue-count").textContent = queue.length + " รายการ";
    const queueRoot = $("monitor-queue");
    if (queueRoot) queueRoot.innerHTML = queue.length ? queue.map((row) => `<div class="monitor-row"><div><button type="button" class="monitor-user-link" data-monitor-user="${escapeHtml(row.user_id || "")}">${escapeHtml(row.username || "—")}</button><small>${escapeHtml(row.job_kind || "งาน")} · เข้า ${escapeHtml(formatMonitorTime(row.joined_at))}</small></div><span class="monitor-status is-queued">${escapeHtml(row.status || "waiting")}</span></div>`).join("") : "ไม่มีคิวที่รออยู่";
    const jobIndex = new Map();
    [...(data.active_jobs || []), ...(data.recent_jobs || [])].forEach((row) => {
      jobIndex.set(row.job_id || (row.user_id + ":" + row.created_at), row);
    });
    const jobs = [...jobIndex.values()].filter((row) => monitorSearchMatches(row, query) && (status === "all" || row.status === status));
    const jobsRoot = $("monitor-jobs");
    if (jobsRoot) jobsRoot.innerHTML = jobs.length ? jobs.map((row) => `<article class="monitor-job"><div><button type="button" class="monitor-user-link" data-monitor-user="${escapeHtml(row.user_id || "")}">${escapeHtml(row.username || "—")}</button><b>${escapeHtml(row.kind || "งาน")}</b><small>${escapeHtml(formatMonitorTime(row.finished_at || row.started_at || row.created_at))}${row.claimed_by ? " · " + escapeHtml(row.claimed_by) : ""}</small></div><div><span class="monitor-status is-${escapeHtml(row.status || "unknown")}">${escapeHtml(row.status || "—")}</span>${row.error ? `<small class="monitor-error">${escapeHtml(row.error)}</small>` : ""}</div>${monitorJobLogMarkup(row.job_id)}</article>`).join("") : "ไม่พบงานตามตัวกรอง";
    const userRoot = $("monitor-users");
    const users = (data.users || []).filter((row) => monitorSearchMatches(row, query));
    if ($("monitor-user-scope")) $("monitor-user-scope").textContent = "สรุปจากงานล่าสุด " + (data.activity_window ?? 0) + " รายการ";
    if (userRoot) userRoot.innerHTML = users.length ? users.map((row) => `<article class="monitor-user-summary"><button type="button" class="monitor-user-link" data-monitor-user="${escapeHtml(row.user_id || "")}">${escapeHtml(row.username || "—")}</button><strong>${escapeHtml(String(row.jobs || 0))} งาน</strong><small>สำเร็จ ${escapeHtml(String(row.succeeded || 0))} · ล้มเหลว ${escapeHtml(String(row.failed || 0))} · ${escapeHtml(Object.entries(row.kinds || {}).map(([kind, count]) => kind + " " + count).join(", "))}</small></article>`).join("") : "ไม่พบผู้ใช้ตามคำค้น";
  }

  async function loadMonitor() {
    const status = $("monitor-status");
    if (status) setStatus(status, "กำลังอัปเดตสถานะ worker และคิว…", "muted");
    try {
      monitorData = PREVIEW_MODE ? previewMonitorPayload() : await api("/api/admin/monitor?limit=100");
      renderMonitor();
      if (status) setStatus(status, "อัปเดตแล้ว · รีเฟรชอัตโนมัติทุก 10 วินาทีขณะเปิดแท็บนี้", "ok");
    } catch (e) {
      if (status) setStatus(status, e.message || String(e), "err");
    }
  }

  function startMonitorPolling() {
    loadMonitor();
    if (monitorTimer) return;
    monitorTimer = setInterval(() => { if (currentView === "monitor" && !document.hidden) loadMonitor(); }, 10000);
  }

  function stopMonitorPolling() {
    if (monitorTimer) clearInterval(monitorTimer);
    monitorTimer = null;
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
    animateKpi($("kpi-users"), total);
    animateKpi($("kpi-active"), active);
    animateKpi($("kpi-expired"), expired);
    animateKpi($("kpi-expire-today"), countExpiring(0));
    animateKpi($("kpi-expire-tomorrow"), countExpiring(1));
    if ($("kpi-topups")) {
      animateKpi(
        $("kpi-topups"),
        adminMode === "web" && lastStats ? lastStats.topups ?? "—" : "—"
      );
    }
    if ($("users-count-label")) {
      const filtered = getFilteredUsers().length;
      const shown = Math.min(filtered, usersVisibleLimit);
      $("users-count-label").textContent =
        "แสดง " + shown + " จาก " + filtered + " คน (ทั้งหมด " + total + ")";
    }
    paintFilterCounts();
    paintOverviewAlerts();
  }

  /* ---- Data loaders ---- */
  async function loadStuckTopups() {
    const root = $("stuck-topups");
    if (!root) return;
    if (PREVIEW_MODE) {
      stuckCount = 2;
      root.className = "admin-list";
      root.innerHTML =
        '<div class="admin-row"><div class="admin-row-head"><strong>7 วัน · ฿350</strong><span class="tag tag-expired">Preview</span></div><div class="muted">ตัวอย่างรายการเติมที่ต้องตรวจสอบ</div></div>' +
        '<div class="admin-row"><div class="admin-row-head"><strong>30 วัน · ฿990</strong><span class="tag tag-expired">Preview</span></div><div class="muted">ข้อมูลจำลองสำหรับดู layout เท่านั้น</div></div>';
      paintOverviewAlerts();
      return;
    }
    root.className = "admin-list";
    root.innerHTML = skeletonHtml("list");
    try {
      const data = await api("/api/admin/topups?status=needs_manual");
      const items = data.items || [];
      stuckCount = items.length;
      paintOverviewAlerts();
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
    const recent = $("recent-activity");
    if (PREVIEW_MODE) {
      lastAudit = PREVIEW_AUDIT;
      paintAuditList();
      paintRecentActivity();
      return;
    }
    if (root) {
      root.className = "admin-list";
      root.innerHTML = skeletonHtml("list");
    }
    if (recent) {
      recent.className = "activity-list";
      recent.innerHTML = skeletonHtml("list");
    }
    try {
      const data = await api("/api/admin/audit?limit=80");
      lastAudit = data.items || [];
      paintAuditList();
      paintRecentActivity();
    } catch (e) {
      if (root) root.textContent = e.message || String(e);
    }
  }

  async function loadStats() {
    const root = $("daily-stats-cards");
    if (!root) return;
    if (PREVIEW_MODE) {
      lastStats = PREVIEW_STATS;
      paintStatsCards();
      paintKpis();
      return;
    }
    root.className = "mini-stat-grid";
    root.innerHTML = skeletonHtml("stats");
    try {
      const data = await api("/api/admin/stats");
      lastStats = data;
      paintStatsCards();
      paintKpis();
    } catch (e) {
      root.textContent = e.message || String(e);
    }
  }

  function readFeatureLocksFromUi() {
    const out = {};
    FEATURE_LOCK_KEYS.forEach((k) => {
      out[k] = false;
    });
    document.querySelectorAll("[data-feature-lock]").forEach((el) => {
      const key = el.getAttribute("data-feature-lock");
      if (!key || !(key in out)) return;
      out[key] = !!el.checked;
    });
    return out;
  }

  function normalizeFarmFeatureOrder(raw) {
    const allowed = new Set(DEFAULT_FARM_FEATURE_ORDER);
    const seen = new Set();
    const out = [];
    (Array.isArray(raw) ? raw : []).forEach((item) => {
      let k = String(item || "").trim();
      if (k === "cookie_unlock") k = "cookie";
      if (!allowed.has(k) || seen.has(k)) return;
      seen.add(k);
      out.push(k);
    });
    DEFAULT_FARM_FEATURE_ORDER.forEach((k) => {
      if (!seen.has(k)) out.push(k);
    });
    return out;
  }

  function readFeatureOrderFromUi() {
    const keys = [...document.querySelectorAll("#feature-order-list [data-feature]")]
      .map((el) => el.getAttribute("data-feature"))
      .filter(Boolean);
    return normalizeFarmFeatureOrder(keys.length ? keys : featureOrderState);
  }

  function currentLockSnapshot() {
    const locks = { ...(settingsCache.feature_locks || {}) };
    document.querySelectorAll("[data-feature-lock]").forEach((el) => {
      const key = el.getAttribute("data-feature-lock");
      if (key) locks[key] = !!el.checked;
    });
    return locks;
  }

  function paintFeatureOrderList() {
    const root = $("feature-order-list");
    if (!root) return;
    const locks = currentLockSnapshot();
    const order = normalizeFarmFeatureOrder(featureOrderState);
    featureOrderState = order;
    featureCatalogState = normalizeFeatureCatalog(featureCatalogState);
    root.replaceChildren();
    order.forEach((key, idx) => {
      const meta = featureCatalogState[key] || {};
      const row = document.createElement("div");
      row.className = "feature-order-row";
      row.dataset.feature = key;
      row.setAttribute("role", "listitem");
      row.draggable = true;

      const grip = document.createElement("span");
      grip.className = "feature-order-grip";
      grip.setAttribute("aria-hidden", "true");
      grip.textContent = "⋮⋮";

      const iconWrap = document.createElement("div");
      iconWrap.className = "feature-order-icon-wrap";
      const iconImg = document.createElement("img");
      iconImg.className = "feature-order-icon";
      iconImg.alt = "";
      iconImg.width = 36;
      iconImg.height = 36;
      iconImg.src = resolveFeatureIconUrl(meta.icon || DEFAULT_FEATURE_ICONS[key]);
      iconImg.onerror = () => {
        iconImg.onerror = null;
        iconImg.src = resolveFeatureIconUrl(DEFAULT_FEATURE_ICONS[key]);
      };
      iconWrap.appendChild(iconImg);

      const nameCol = document.createElement("div");
      nameCol.className = "feature-order-name";
      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "feature-order-label-input";
      labelInput.setAttribute("data-feature-label", key);
      labelInput.maxLength = 40;
      labelInput.value = meta.label || FEATURE_LOCK_LABELS[key] || key;
      labelInput.addEventListener("mousedown", (ev) => ev.stopPropagation());
      labelInput.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      labelInput.addEventListener("click", (ev) => ev.stopPropagation());
      labelInput.addEventListener("dragstart", (ev) => ev.preventDefault());
      const iconActions = document.createElement("div");
      iconActions.className = "feature-order-icon-actions";
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/png,image/jpeg,image/webp,image/gif";
      fileInput.hidden = true;
      const changeBtn = document.createElement("button");
      changeBtn.type = "button";
      changeBtn.className = "btn btn-ghost btn-sm";
      changeBtn.textContent = "รูป";
      changeBtn.title = "เปลี่ยนรูปฟังก์ชัน";
      changeBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        fileInput.click();
      });
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "btn btn-ghost btn-sm";
      resetBtn.textContent = "รีเซ็ต";
      resetBtn.title = "คืนรูปเดิม";
      resetBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        setBtnLoading(resetBtn, true);
        try {
          const data = await api("/api/admin/feature-icon/" + encodeURIComponent(key), {
            method: "DELETE",
          });
          featureCatalogState = normalizeFeatureCatalog(data.feature_catalog);
          paintFeatureOrderList();
          toast("คืนรูป " + (FEATURE_LOCK_LABELS[key] || key) + " แล้ว", "ok");
        } catch (err) {
          toast(err.message || String(err), "err");
        } finally {
          setBtnLoading(resetBtn, false);
        }
      });
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = "";
        if (!file) return;
        setBtnLoading(changeBtn, true);
        try {
          const fd = new FormData();
          fd.append("file", file, file.name || key + ".png");
          const data = await apiUpload("/api/admin/feature-icon/" + encodeURIComponent(key), fd);
          featureCatalogState = normalizeFeatureCatalog(data.feature_catalog);
          paintFeatureOrderList();
          toast("อัปเดตรูปแล้ว", "ok");
        } catch (err) {
          toast(err.message || String(err), "err");
        } finally {
          setBtnLoading(changeBtn, false);
        }
      });
      iconActions.append(changeBtn, resetBtn, fileInput);
      nameCol.append(labelInput, iconActions);

      row.append(grip, iconWrap, nameCol);
      if (FEATURE_LOCK_KEY_SET.has(key)) {
        const tog = document.createElement("label");
        tog.className = "toggle-field";
        const inp = document.createElement("input");
        inp.type = "checkbox";
        inp.setAttribute("data-feature-lock", key);
        inp.checked = !!locks[key];
        const span = document.createElement("span");
        span.textContent = "ปิด";
        tog.append(inp, span);
        row.appendChild(tog);
      } else {
        const always = document.createElement("span");
        always.className = "feature-order-always";
        always.textContent = "เปิดเสมอ";
        row.appendChild(always);
      }
      const move = document.createElement("div");
      move.className = "feature-order-move";
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "▲";
      up.setAttribute("aria-label", "เลื่อนขึ้น");
      up.disabled = idx === 0;
      up.addEventListener("click", () => moveFeature(key, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "▼";
      down.setAttribute("aria-label", "เลื่อนลง");
      down.disabled = idx === order.length - 1;
      down.addEventListener("click", () => moveFeature(key, 1));
      move.append(up, down);
      row.appendChild(move);
      root.appendChild(row);
    });
  }

  function moveFeature(key, dir) {
    const order = readFeatureOrderFromUi();
    const from = order.indexOf(key);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = order.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    featureOrderState = next;
    paintFeatureOrderList();
  }

  function bindFeatureOrderDrag() {
    const root = $("feature-order-list");
    if (!root || root.dataset.dragBound) return;
    root.dataset.dragBound = "1";
    let dragging = null;
    root.addEventListener("dragstart", (ev) => {
      const row = ev.target.closest(".feature-order-row");
      if (!row) return;
      dragging = row;
      row.classList.add("is-dragging");
      try {
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", row.dataset.feature || "");
      } catch (_) {}
    });
    root.addEventListener("dragend", () => {
      if (dragging) dragging.classList.remove("is-dragging");
      dragging = null;
      featureOrderState = readFeatureOrderFromUi();
    });
    root.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      const row = ev.target.closest(".feature-order-row");
      if (!dragging || !row || row === dragging) return;
      const rect = row.getBoundingClientRect();
      if (ev.clientY < rect.top + rect.height / 2) root.insertBefore(dragging, row);
      else root.insertBefore(dragging, row.nextSibling);
    });
  }

  function paintFeatureLockToggles(locks) {
    const map = locks && typeof locks === "object" ? locks : {};
    settingsCache.feature_locks = map;
    document.querySelectorAll("[data-feature-lock]").forEach((el) => {
      const key = el.getAttribute("data-feature-lock");
      el.checked = !!map[key];
    });
  }

  function parseUsernameList(text) {
    return String(text || "")
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function ensureEarlyAccessSelect() {
    const sel = $("early-access-feature");
    if (!sel || earlyAccessSelectReady) return sel;
    sel.innerHTML = "";
    FEATURE_LOCK_KEYS.forEach((k) => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent =
        (featureCatalogState[k] && featureCatalogState[k].label) ||
        FEATURE_LOCK_LABELS[k] ||
        k;
      sel.appendChild(opt);
    });
    const locks = settingsCache.feature_locks || {};
    const firstLocked = FEATURE_LOCK_KEYS.find((k) => locks[k]);
    sel.value = firstLocked || FEATURE_LOCK_KEYS[0];
    earlyAccessSelectReady = true;
    return sel;
  }

  function paintEarlyAccessEditor() {
    const sel = ensureEarlyAccessSelect();
    const ta = $("early-access-usernames");
    const cur = $("early-access-current");
    const key = sel?.value || FEATURE_LOCK_KEYS[0];
    const entries = earlyAccessCache[key] || [];
    const names = entries.map((e) => e.username).filter(Boolean);
    if (ta) ta.value = names.join("\n");
    if (cur) {
      cur.textContent = names.length
        ? "ปัจจุบัน: " + names.join(", ")
        : "ปัจจุบัน: ยังไม่มีใคร";
    }
  }

  async function loadEarlyAccess() {
    try {
      const data = await api("/api/admin/early-access");
      earlyAccessCache = data.features && typeof data.features === "object" ? data.features : {};
      paintEarlyAccessEditor();
    } catch (_) {
      earlyAccessCache = {};
      paintEarlyAccessEditor();
    }
  }

  async function saveEarlyAccess() {
    const sel = $("early-access-feature");
    const feature = sel?.value;
    if (!feature) throw new Error("เลือกฟีเจอร์ก่อน");
    const usernames = parseUsernameList($("early-access-usernames")?.value || "");
    const data = await api("/api/admin/early-access/" + encodeURIComponent(feature), {
      method: "PUT",
      body: { usernames },
    });
    earlyAccessCache = data.features && typeof data.features === "object" ? data.features : {};
    paintEarlyAccessEditor();
    const n = (earlyAccessCache[feature] || []).length;
    return n ? "บันทึกแล้ว · " + n + " คน" : "บันทึกแล้ว · ไม่มีใครในรายชื่อ";
  }

  function setFieldVal(id, value) {
    const el = $(id);
    if (!el || value == null) return;
    if (el.type === "checkbox") el.checked = !!value;
    else el.value = value;
  }

  function numOr(id, fallback) {
    const n = Number($(id)?.value);
    return Number.isFinite(n) ? n : fallback;
  }

  function paintAfterplayProfiles(data) {
    const mx = data?.afterplay_profile_money_xp || {};
    const eb = data?.afterplay_profile_episode_box || {};
    if ($("ap-mx-capture")) $("ap-mx-capture").value = mx.capture === "play10" ? "play10" : "highscore_ep1";
    if ($("ap-mx-box-pick")) $("ap-mx-box-pick").value = mx.box_pick === "best" ? "best" : "all";
    setFieldVal("ap-mx-box-max", mx.box_max == null ? 0 : mx.box_max);
    setFieldVal("ap-mx-overlap", mx.overlap);
    setFieldVal("ap-mx-stagger", mx.stagger);
    setFieldVal("ap-mx-spawn-gap", mx.spawn_gap);
    setFieldVal("ap-mx-gate-extra", mx.gate_extra);
    setFieldVal("ap-mx-beforeplay-retry", mx.beforeplay_retry);
    setFieldVal("ap-mx-coin-min", mx.coin_min);
    setFieldVal("ap-mx-coin-max", mx.coin_max);
    setFieldVal("ap-mx-exp-min", mx.exp_min);
    setFieldVal("ap-mx-exp-max", mx.exp_max);
    if ($("ap-mx-claim-box")) $("ap-mx-claim-box").checked = mx.claim_box !== false;
    if ($("ap-mx-allow-box")) $("ap-mx-allow-box").checked = mx.allow_customer_box_max !== false;
    if ($("ap-mx-lock-box")) $("ap-mx-lock-box").checked = !!mx.lock_box_max;
    if ($("ap-mx-randomize")) $("ap-mx-randomize").checked = mx.randomize !== false;
    if ($("ap-mx-clamp-life")) $("ap-mx-clamp-life").checked = !!mx.clamp_to_life;
    if ($("ap-mx-stop-flag")) $("ap-mx-stop-flag").checked = !!mx.stop_on_flag;
    if ($("ap-mx-strip-treasure")) $("ap-mx-strip-treasure").checked = mx.strip_treasure !== false;
    if ($("ap-eb-box-pick")) $("ap-eb-box-pick").value = eb.box_pick === "best" ? "best" : "all";
    setFieldVal("ap-eb-box-max", eb.box_max == null ? 0 : eb.box_max);
    setFieldVal("ap-eb-overlap", eb.overlap);
    setFieldVal("ap-eb-gate-extra", eb.gate_extra);
    setFieldVal("ap-eb-claim-gap", eb.claim_gap);
    setFieldVal("ap-eb-default-runs", eb.default_runs_per_ep);
    if ($("ap-eb-allow-box")) $("ap-eb-allow-box").checked = eb.allow_customer_box_max !== false;
    if ($("ap-eb-lock-box")) $("ap-eb-lock-box").checked = !!eb.lock_box_max;
    if ($("ap-eb-clamp-life")) $("ap-eb-clamp-life").checked = eb.clamp_to_life !== false;
    if ($("ap-eb-stop-flag")) $("ap-eb-stop-flag").checked = !!eb.stop_on_flag;
    if ($("ap-eb-ice")) $("ap-eb-ice").checked = eb.ice_tower_for_ep5 !== false;
    if ($("ap-eb-gashapon")) $("ap-eb-gashapon").checked = false;
    if ($("ap-eb-skip-l")) $("ap-eb-skip-l").checked = false;
  }

  function readAfterplayProfilesFromUi() {
    return {
      afterplay_profile_money_xp: {
        capture: $("ap-mx-capture")?.value === "play10" ? "play10" : "highscore_ep1",
        box_pick: $("ap-mx-box-pick")?.value === "best" ? "best" : "all",
        box_max: Math.max(0, Math.min(3, Math.floor(numOr("ap-mx-box-max", 0)))),
        overlap: Math.max(1, Math.min(2, Math.floor(numOr("ap-mx-overlap", 2)))),
        stagger: numOr("ap-mx-stagger", 0.3),
        spawn_gap: numOr("ap-mx-spawn-gap", 0.2),
        gate_extra: numOr("ap-mx-gate-extra", 0),
        beforeplay_retry: Math.max(0, Math.floor(numOr("ap-mx-beforeplay-retry", 2))),
        coin_min: Math.floor(numOr("ap-mx-coin-min", 350000)),
        coin_max: Math.floor(numOr("ap-mx-coin-max", 420000)),
        exp_min: Math.floor(numOr("ap-mx-exp-min", 69000)),
        exp_max: Math.floor(numOr("ap-mx-exp-max", 79999)),
        claim_box: !!$("ap-mx-claim-box")?.checked,
        allow_customer_box_max: !!$("ap-mx-allow-box")?.checked,
        lock_box_max: !!$("ap-mx-lock-box")?.checked,
        randomize: !!$("ap-mx-randomize")?.checked,
        clamp_to_life: !!$("ap-mx-clamp-life")?.checked,
        stop_on_flag: !!$("ap-mx-stop-flag")?.checked,
        strip_treasure: !!$("ap-mx-strip-treasure")?.checked,
      },
      afterplay_profile_episode_box: {
        box_pick: $("ap-eb-box-pick")?.value === "best" ? "best" : "all",
        box_max: Math.max(0, Math.min(3, Math.floor(numOr("ap-eb-box-max", 0)))),
        overlap: Math.max(1, Math.min(2, Math.floor(numOr("ap-eb-overlap", 2)))),
        gate_extra: numOr("ap-eb-gate-extra", 0),
        claim_gap: numOr("ap-eb-claim-gap", 0.15),
        default_runs_per_ep: Math.max(1, Math.floor(numOr("ap-eb-default-runs", 5))),
        allow_customer_box_max: !!$("ap-eb-allow-box")?.checked,
        lock_box_max: !!$("ap-eb-lock-box")?.checked,
        clamp_to_life: !!$("ap-eb-clamp-life")?.checked,
        stop_on_flag: !!$("ap-eb-stop-flag")?.checked,
        ice_tower_for_ep5: !!$("ap-eb-ice")?.checked,
        allow_gashapon: false,
        skip_owned_l: false,
      },
    };
  }

  function setApProfileTab(tab) {
    const mode = tab === "episode_box" ? "episode_box" : "money_xp";
    document.querySelectorAll("[data-ap-profile-tab]").forEach((btn) => {
      const on = btn.getAttribute("data-ap-profile-tab") === mode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    const mx = $("ap-profile-money_xp");
    const eb = $("ap-profile-episode_box");
    if (mx) {
      mx.hidden = mode !== "money_xp";
      mx.classList.toggle("hidden", mode !== "money_xp");
    }
    if (eb) {
      eb.hidden = mode !== "episode_box";
      eb.classList.toggle("hidden", mode !== "episode_box");
    }
  }

  function defaultAdminTopupPackages() {
    return [
      { id: "full_1d", kind: "full", label_th: "1 วัน", price_baht: 200, days: 1, hours: 24, active: true },
      { id: "full_3d", kind: "full", label_th: "3 วัน", price_baht: 500, days: 3, hours: 72, active: true, promo: true },
      { id: "full_7d", kind: "full", label_th: "7 วัน", price_baht: 990, days: 7, hours: 168, active: true, promo: true },
      { id: "feat_12h", kind: "feature", label_th: "12 ชม. · 1 ฟังก์ชัน", price_baht: 50, hours: 12, active: true },
    ];
  }

  function renderAdminTopupPackages() {
    const root = $("topup-packages-admin-list");
    if (!root) return;
    root.setAttribute("aria-busy", "false");
    if (!adminTopupPackages.length) {
      root.innerHTML = '<p class="muted">ยังไม่มีแพ็กเติมวัน · กด “เพิ่มแพ็ก” เพื่อสร้างรายการ</p>';
      return;
    }
    root.innerHTML = adminTopupPackages
      .map((pkg, index) => {
        const kind = pkg.kind === "feature" ? "feature" : "full";
        const id = escapeHtml(String(pkg.id || "full_custom_" + (index + 1)));
        const label = escapeHtml(String(pkg.label_th || ""));
        const price = Number(pkg.price_baht) || 0;
        const days = Number(pkg.days ?? pkg.package_days) || 1;
        const hours = Number(pkg.hours) || 12;
        return (
          '<div class="topup-package-admin-row is-' + kind + '" data-package-index="' + index + '">' +
          '<label class="field"><span>ชื่อแพ็ก</span><input data-package-field="label_th" value="' + label + '" maxlength="80" /></label>' +
          '<label class="field"><span>ประเภท</span><select data-package-field="kind"><option value="full"' + (kind === "full" ? " selected" : "") + '>เติมวัน</option><option value="feature"' + (kind === "feature" ? " selected" : "") + '>เลือกฟังก์ชัน</option></select></label>' +
          '<label class="field"><span>ราคา (บาท)</span><input data-package-field="price_baht" type="number" min="1" max="1000000" step="1" value="' + price + '" /></label>' +
          '<label class="field package-kind-full"><span>จำนวนวัน</span><input data-package-field="days" type="number" min="1" max="3650" step="1" value="' + days + '" /></label>' +
          '<label class="field package-kind-feature"><span>จำนวนชั่วโมง</span><input data-package-field="hours" type="number" min="1" max="87600" step="1" value="' + hours + '" /></label>' +
          '<label class="toggle-field package-active-field"><input data-package-field="active" type="checkbox"' + (pkg.active !== false ? " checked" : "") + ' /><span>เปิดขาย</span></label>' +
          '<span class="muted package-id-note" title="รหัสใช้กับประวัติและรายการเติมเงิน">ID: ' + id + '</span>' +
          '</div>'
        );
      })
      .join("");
  }

  function syncAdminTopupRow(row) {
    if (!row) return;
    const kind = row.querySelector('[data-package-field="kind"]')?.value === "feature" ? "feature" : "full";
    row.classList.toggle("is-full", kind === "full");
    row.classList.toggle("is-feature", kind === "feature");
  }

  function readAdminTopupPackages() {
    const root = $("topup-packages-admin-list");
    if (!root) return [];
    return Array.from(root.querySelectorAll("[data-package-index]")).map((row) => {
      const value = (field) => row.querySelector('[data-package-field="' + field + '"]')?.value;
      const kind = value("kind") === "feature" ? "feature" : "full";
      const out = {
        id: adminTopupPackages[Number(row.dataset.packageIndex)]?.id || "",
        kind,
        label_th: String(value("label_th") || "").trim(),
        price_baht: Math.max(1, Math.floor(Number(value("price_baht")) || 0)),
        active: !!row.querySelector('[data-package-field="active"]')?.checked,
      };
      if (kind === "feature") {
        out.hours = Math.max(1, Math.floor(Number(value("hours")) || 12));
      } else {
        out.days = Math.max(1, Math.floor(Number(value("days")) || 1));
      }
      return out;
    });
  }

  async function loadAdminTopupPackages() {
    const root = $("topup-packages-admin-list");
    if (!root) return;
    if (PREVIEW_MODE) {
      adminTopupPackages = defaultAdminTopupPackages();
      renderAdminTopupPackages();
      return;
    }
    root.setAttribute("aria-busy", "true");
    root.textContent = "กำลังโหลด…";
    try {
      const data = await api("/api/admin/topup/packages");
      adminTopupPackages = Array.isArray(data.packages) ? data.packages : [];
      renderAdminTopupPackages();
    } catch (err) {
      root.setAttribute("aria-busy", "false");
      root.textContent = err.message || String(err);
      setStatus($("topup-packages-status"), err.message || String(err), "err");
    }
  }

  async function saveAdminTopupPackages() {
    const payload = readAdminTopupPackages();
    if (!payload.length) throw new Error("ต้องมีแพ็กอย่างน้อย 1 รายการ หรือใช้ปิดเติมเงินทั้งหมด");
    const response = await api("/api/admin/topup/packages", {
      method: "POST",
      body: { packages: payload },
    });
    adminTopupPackages = Array.isArray(response?.packages) ? response.packages : payload;
    renderAdminTopupPackages();
    await loadAudit();
  }

  async function loadSettings() {
    if (PREVIEW_MODE) {
      settingsCache = {
        ...PREVIEW_SETTINGS,
        feature_locks: { ...PREVIEW_SETTINGS.feature_locks },
        farm_feature_order: [...PREVIEW_SETTINGS.farm_feature_order],
      };
      paintSettingsControls(settingsCache);
      featureOrderState = normalizeFarmFeatureOrder(settingsCache.farm_feature_order);
      paintFeatureOrderList();
      paintFeatureLockToggles(settingsCache.feature_locks);
      earlyAccessCache = {
        unlock_l: [{ username: "alpha.demo" }],
      };
      paintEarlyAccessEditor();
      paintAfterplayProfiles(settingsCache);
      paintOverviewAlerts();
      return;
    }
    try {
      const data = await api("/api/admin/settings");
      settingsCache = normalizeSettings(data, settingsCache);
      paintSettingsControls(settingsCache);
      featureOrderState = normalizeFarmFeatureOrder(settingsCache.farm_feature_order);
      featureCatalogState = normalizeFeatureCatalog(settingsCache.feature_catalog);
      paintFeatureOrderList();
      paintFeatureLockToggles(settingsCache.feature_locks);
      loadEarlyAccess().catch(() => {});
      paintAfterplayProfiles(settingsCache);
      paintOverviewAlerts();
      loadAdminProxy().catch(() => {});
      loadHeartHelpers().catch(() => {});
      loadInvitePoolStats().catch(() => {});
    } catch (err) {
      const recovered = normalizeSettings({}, settingsCache);
      if (Object.keys(recovered).length) {
        settingsCache = recovered;
        paintSettingsControls(settingsCache);
        featureOrderState = normalizeFarmFeatureOrder(settingsCache.farm_feature_order);
        featureCatalogState = normalizeFeatureCatalog(settingsCache.feature_catalog);
        paintFeatureOrderList();
        paintFeatureLockToggles(settingsCache.feature_locks);
        paintAfterplayProfiles(settingsCache);
      }
      setStatus($("settings-status"), err.message || String(err), "err");
    }
  }

  function paintProxyBadge(state, label) {
    const badge = $("proxy-status-badge");
    if (!badge) return;
    badge.className = "proxy-badge is-" + (state || "unknown");
    badge.textContent = label || "—";
  }

  function paintAdminProxy(data) {
    if (!data) return;
    const masked = $("proxy-current-masked");
    if (masked) {
      const src = data.source ? " · " + data.source : "";
      masked.textContent =
        "ปัจจุบัน: " + (data.proxy_url_masked || "ยังไม่ตั้ง") + src;
    }
    const pool = data.pool || {};
    const poolLine = $("proxy-pool-line");
    if (poolLine) {
      if (pool.remaining_pct != null) {
        poolLine.textContent =
          "Pool: เหลือ " +
          Number(pool.remaining_pct).toFixed(0) +
          "%" +
          (pool.expiration_time ? " · หมดอายุ " + pool.expiration_time : "");
      } else if (pool.usage_available && pool.used_pct != null) {
        poolLine.textContent =
          "Pool: ใช้ไป " +
          Number(pool.used_pct).toFixed(1) +
          "%" +
          (pool.detail ? " · " + pool.detail : "");
      } else {
        poolLine.textContent = "Pool: " + (pool.detail || "ยังไม่มีสถิติ");
      }
    }
    const socksMasked = $("socks-current-masked");
    if (socksMasked) {
      const src = data.socks_source ? " · " + data.socks_source : "";
      socksMasked.textContent =
        "SOCKS ปัจจุบัน: " + (data.socks_url_masked || "ยังไม่ตั้ง") + src;
    }
    const tokenLine = $("webshare-token-masked");
    if (tokenLine) {
      const configured = data.thordata_token_configured || data.webshare_token_configured;
      const masked = data.thordata_token_masked || data.webshare_token_masked;
      tokenLine.textContent = configured
        ? "Token ปัจจุบัน: " + (masked || "ตั้งแล้ว")
        : "Token ปัจจุบัน: ยังไม่ตั้ง — Pool จะไม่มีตัวเลขเน็ตเหลือ";
    }
    const check = data.check;
    if (data.ready || (check && check.ok)) {
      const ips = (check && check.exit_ips) || [];
      const rot = check && check.rotating ? " · rotating" : "";
      paintProxyBadge("ready", "พร้อมใช้งาน" + rot);
      setStatus(
        $("proxy-status"),
        ips.filter(Boolean).length
          ? "exit IP: " + ips.filter(Boolean).join(" → ")
          : "Proxy พร้อมใช้งาน",
        "ok"
      );
    } else if (data.configured) {
      paintProxyBadge("warn", "ตั้งแล้ว · ยังไม่ผ่านตรวจ");
      const err = (check && (check.error || check.detail)) || "ยังไม่ได้ตรวจ";
      setStatus($("proxy-status"), err, "err");
    } else {
      paintProxyBadge("off", "ยังไม่พร้อม");
      setStatus($("proxy-status"), "ยังไม่ได้ตั้ง proxy", "muted");
    }
  }

  async function loadInvitePoolStats() {
    const el = $("invite-pool-stats");
    if (PREVIEW_MODE) {
      if (el) el.textContent = "Ready: 24 · Links: 3 · Reserved: 1 · Spent: 18 · (29 guest/link)";
      return {
        ready: 24,
        links_available: 3,
        reserved: 1,
        spent: 18,
        guests_per_link: 29,
      };
    }
    try {
      const data = await api("/api/admin/invite-pool/stats");
      if (el) {
        el.textContent =
          "Ready: " +
          (data.ready ?? "—") +
          " · Links: " +
          (data.links_available ?? "—") +
          " · Reserved: " +
          (data.reserved ?? 0) +
          " · Spent: " +
          (data.spent ?? 0) +
          " · (" +
          (data.guests_per_link || 29) +
          " guest/link)";
      }
      return data;
    } catch (err) {
      if (el) el.textContent = "โหลดสถิติไม่สำเร็จ";
      setStatus($("invite-pool-status"), err.message || String(err), "err");
      return null;
    }
  }

  async function clearInvitePool(scope, force) {
    const status = $("invite-pool-status");
    const scopeKey = scope || "ready";
    const isAll = scopeKey === "all";
    const stats = await loadInvitePoolStats();
    const ready = stats?.ready ?? "—";
    const reserved = stats?.reserved ?? 0;

    if (isAll) {
      const ok = await showConfirmModal({
        title: "ล้าง Invite Pool ทั้งหมด?",
        body:
          "ลบ guest ทุกสถานะ (ready / spent / invalid" +
          (force ? " / reserved" : "") +
          ") — ไม่สามารถกู้คืนได้\nReady: " +
          ready +
          " · Reserved: " +
          reserved,
        confirmLabel: force ? "ล้างทั้งหมด (บังคับ)" : "ล้างทั้งหมด",
        danger: true,
      });
      if (!ok) return;
    } else {
      const ok = await showConfirmModal({
        title: "ล้าง guest Ready?",
        body: "ลบ guest ที่พร้อมใช้งาน " + ready + " รายการ — ไม่สามารถกู้คืนได้",
        confirmLabel: "ล้าง Ready",
        danger: true,
      });
      if (!ok) return;
    }

    const btnId = isAll ? "invite-pool-clear-all-btn" : "invite-pool-clear-ready-btn";
    setBtnLoading($(btnId), true);
    setStatus(status, "กำลังล้าง pool…", "muted");
    try {
      const data = await api("/api/admin/invite-pool/clear", {
        method: "POST",
        body: { scope: scopeKey, force: Boolean(force) },
      });
      const deleted = data.deleted ?? 0;
      setStatus(
        status,
        "ลบ " +
          deleted +
          " รายการ · Ready " +
          (data.ready ?? 0) +
          " · Links " +
          (data.links_available ?? 0),
        "ok"
      );
      toast("ล้าง Invite Pool สำเร็จ (−" + deleted + ")", "ok");
      await loadInvitePoolStats();
    } catch (err) {
      const detail = err.data?.detail;
      if (detail?.code === "reserved_guests" && isAll && !force) {
        const retry = await showConfirmModal({
          title: "ยังมี guest Reserved",
          body:
            "มี guest ถูกจอง " +
            (detail.reserved ?? reserved) +
            " รายการ — ลบต่อ (อาจกระทบงานที่กำลังรัน)?",
          confirmLabel: "ล้างบังคับ",
          danger: true,
        });
        if (retry) {
          setBtnLoading($(btnId), false);
          return clearInvitePool("all", true);
        }
      }
      setStatus(status, err.message || String(err), "err");
    } finally {
      setBtnLoading($(btnId), false);
    }
  }

  async function mergeInvitePool() {
    const status = $("invite-pool-status");
    let raw = null;
    const text = String($("invite-pool-text")?.value || "").trim();
    const file = $("invite-pool-file")?.files?.[0];
    try {
      if (file) {
        const fileText = await file.text();
        raw = JSON.parse(fileText);
      } else if (text) {
        raw = JSON.parse(text);
      } else {
        setStatus(status, "เลือกไฟล์หรือวาง JSON ก่อน", "err");
        return;
      }
    } catch (err) {
      setStatus(status, "JSON ไม่ถูกต้อง: " + (err.message || err), "err");
      return;
    }

    setBtnLoading($("invite-pool-merge-btn"), true);
    setStatus(status, "กำลัง merge…", "muted");
    try {
      const data = await api("/api/admin/invite-pool/merge", {
        method: "POST",
        body: { raw, source_batch: file ? file.name : "paste" },
      });
      const inserted = data.inserted ?? 0;
      const skipped = data.skipped_existing ?? 0;
      setStatus(
        status,
        "เพิ่ม " + inserted + " · ข้ามซ้ำ " + skipped + " · Ready " + (data.ready ?? "—") + " · Links " + (data.links_available ?? "—"),
        "ok"
      );
      toast("Merge Invite Pool สำเร็จ (+" + inserted + ")", "ok");
      if ($("invite-pool-text")) $("invite-pool-text").value = "";
      if ($("invite-pool-file")) $("invite-pool-file").value = "";
      await loadInvitePoolStats();
    } catch (err) {
      setStatus(status, err.message || String(err), "err");
    } finally {
      setBtnLoading($("invite-pool-merge-btn"), false);
    }
  }

  async function loadAdminProxy() {
    paintProxyBadge("unknown", "กำลังตรวจ…");
    try {
      const data = await api("/api/admin/proxy");
      paintAdminProxy(data);
      return data;
    } catch (err) {
      paintProxyBadge("off", "โหลดไม่สำเร็จ");
      setStatus($("proxy-status"), err.message || String(err), "err");
      return null;
    }
  }

  async function applyAdminProxy() {
    const input = $("admin-proxy-url");
    const url = String(input?.value || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      setStatus($("proxy-status"), "รูปแบบไม่ถูกต้อง — ต้องขึ้นต้นด้วย http:// หรือ https://", "err");
      paintProxyBadge("off", "URL ไม่ถูกต้อง");
      return;
    }
    setBtnLoading($("proxy-apply-btn"), true);
    paintProxyBadge("unknown", "กำลัง Apply…");
    setStatus($("proxy-status"), "บันทึกและทดสอบ proxy…", "muted");
    try {
      const data = await api("/api/admin/proxy", {
        method: "POST",
        body: { proxy_url: url, check: true },
      });
      paintAdminProxy(data);
      if (data.ready || data.check?.ok) {
        toast("Apply proxy สำเร็จ", "ok");
        if (input) input.value = "";
      } else {
        toast("บันทึกแล้วแต่ทดสอบไม่ผ่าน", "err");
      }
      await loadAudit().catch(() => {});
    } catch (err) {
      paintProxyBadge("off", "Apply ไม่สำเร็จ");
      setStatus($("proxy-status"), err.message || String(err), "err");
    } finally {
      setBtnLoading($("proxy-apply-btn"), false);
    }
  }

  async function applyWebshareToken() {
    const input = $("admin-webshare-token");
    const token = String(input?.value || "").trim();
    if (token.length < 8) {
      setStatus($("proxy-status"), "ใส่ Thordata API Token ก่อน", "err");
      return;
    }
    setBtnLoading($("webshare-token-apply-btn"), true);
    setStatus($("proxy-status"), "บันทึก Thordata API Token…", "muted");
    try {
      const data = await api("/api/admin/webshare-token", {
        method: "POST",
        body: { token },
      });
      const proxy = await loadAdminProxy().catch(() => null);
      const pool = data.pool || proxy?.pool || {};
      if (pool.remaining_pct != null) {
        setStatus(
          $("proxy-status"),
          "Token ใหม่ · เหลือ " + Number(pool.remaining_pct).toFixed(0) + "%",
          "ok"
        );
        toast("เปลี่ยน API แล้ว", "ok");
      } else if (pool.usage_available && pool.used_pct != null) {
        setStatus(
          $("proxy-status"),
          "Token ใหม่ · Pool ใช้ไป " + Number(pool.used_pct).toFixed(1) + "%",
          "ok"
        );
        toast("เปลี่ยน API แล้ว", "ok");
      } else {
        setStatus(
          $("proxy-status"),
          "บันทึก Token แล้ว · " + (pool.detail || "ยังไม่มีสถิติ"),
          pool.ok === false ? "err" : "ok"
        );
        toast("บันทึก Token แล้ว", "ok");
      }
      if (input) input.value = "";
      await loadAudit().catch(() => {});
    } catch (err) {
      setStatus($("proxy-status"), err.message || String(err), "err");
      toast("บันทึก Token ไม่สำเร็จ", "err");
    } finally {
      setBtnLoading($("webshare-token-apply-btn"), false);
    }
  }

  async function applyHeartSocks() {
    const input = $("admin-heart-socks-url");
    const url = String(input?.value || "").trim();
    if (!/^socks5h?:\/\//i.test(url)) {
      setStatus($("proxy-status"), "รูปแบบไม่ถูกต้อง — ต้องขึ้นต้นด้วย socks5://", "err");
      return;
    }
    setBtnLoading($("heart-socks-apply-btn"), true);
    setStatus($("proxy-status"), "บันทึก SOCKS5…", "muted");
    try {
      const data = await api("/api/admin/heart-socks", {
        method: "POST",
        body: { socks_url: url },
      });
      paintAdminProxy(data);
      toast("บันทึก SOCKS5 แล้ว", "ok");
      if (input) input.value = "";
      await loadAudit().catch(() => {});
    } catch (err) {
      setStatus($("proxy-status"), err.message || String(err), "err");
      toast("บันทึก SOCKS ไม่สำเร็จ", "err");
    } finally {
      setBtnLoading($("heart-socks-apply-btn"), false);
    }
  }

  function paintHeartHelpers(data) {
    const st = data?.stats || data || {};
    const items = data?.items || [];
    const line = $("heart-helpers-stats");
    if (line) {
      line.textContent =
        "ทั้งหมด: " +
        (st.total ?? "—") +
        " / Login แล้ว: " +
        (st.logged_in ?? "—") +
        " / ผ่าน: " +
        (st.passed ?? "—") +
        " / ไม่ผ่าน 3 รอบ: " +
        (st.fail_3 ?? "—") +
        (items.length ? " · แสดง " + items.length + " รายการ" : "");
    }
    const tbody = $("heart-helpers-tbody");
    if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">ยังไม่มีไอดีในคลัง</td></tr>';
      return;
    }
    tbody.innerHTML = items
      .map((row) => {
        const token = row.has_token ? "มี" : "—";
        const fails = row.fail_customers ? String(row.fail_customers) + "/3" : "0";
        const last = row.last_ok_at || row.last_login_ok_at || row.last_fail_at || "—";
        return (
          "<tr><td>" +
          escapeHtml(row.email || "") +
          "</td><td>" +
          escapeHtml(row.password || "") +
          "</td><td>" +
          escapeHtml(token) +
          "</td><td>" +
          escapeHtml(fails) +
          "</td><td class=\"muted\">" +
          escapeHtml(String(last)) +
          (row.last_error ? "<br>" + escapeHtml(String(row.last_error).slice(0, 80)) : "") +
          "</td></tr>"
        );
      })
      .join("");
  }

  async function loadHeartHelpers() {
    try {
      const data = await api("/api/admin/heart-helpers?limit=100");
      paintHeartHelpers(data);
      if (!heartHelpersTimer) {
        heartHelpersTimer = setInterval(() => {
          loadHeartHelpers().catch(() => {});
        }, 20000);
      }
    } catch (err) {
      setStatus($("heart-helpers-status"), err.message || String(err), "err");
    }
  }

  async function mergeHeartHelpers() {
    const status = $("heart-helpers-status");
    const text = String($("heart-helpers-text")?.value || "");
    if (!text.trim()) {
      setStatus(status, "วางรายชื่อหรือเลือกไฟล์ .txt ก่อน", "err");
      return;
    }
    setBtnLoading($("heart-helpers-merge-btn"), true);
    setStatus(status, "กำลัง Merge…", "muted");
    try {
      const data = await api("/api/admin/heart-helpers/merge", {
        method: "POST",
        body: { text },
      });
      setStatus(
        status,
        "เพิ่ม " +
          (data.added || 0) +
          " · อัปเดต " +
          (data.updated || 0) +
          " · ข้าม " +
          (data.skipped || 0) +
          " · รวม " +
          (data.total || 0),
        "ok"
      );
      toast("Merge คลังส่งแล้ว", "ok");
      if ($("heart-helpers-text")) $("heart-helpers-text").value = "";
      if ($("heart-helpers-file")) $("heart-helpers-file").value = "";
      await loadHeartHelpers();
      await loadAudit().catch(() => {});
    } catch (err) {
      setStatus(status, err.message || String(err), "err");
    } finally {
      setBtnLoading($("heart-helpers-merge-btn"), false);
    }
  }

  async function downloadHeartHelpers() {
    try {
      const headers = {};
      if (accessToken) headers.Authorization = "Bearer " + accessToken;
      if (sessionToken) headers["X-Session-Token"] = sessionToken;
      const res = await fetch(API + "/api/admin/heart-helpers/download", { headers });
      if (!res.ok) throw new Error("download_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "heart_helpers.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("ดาวน์โหลดคลังส่งแล้ว", "ok");
    } catch (err) {
      setStatus($("heart-helpers-status"), err.message || String(err), "err");
    }
  }

  async function checkAdminProxy() {
    setBtnLoading($("proxy-check-btn"), true);
    paintProxyBadge("unknown", "กำลังตรวจ…");
    try {
      const [check, cur] = await Promise.all([
        api("/api/admin/heart/proxy-check"),
        api("/api/admin/proxy").catch(() => null),
      ]);
      paintAdminProxy({
        configured: !!(check.proxy_configured ?? cur?.configured),
        ready: !!check.ok,
        proxy_url_masked: check.proxy_url_masked || cur?.proxy_url_masked,
        source: check.source || cur?.source,
        pool: cur?.pool,
        check,
      });
    } catch (err) {
      paintProxyBadge("off", "ตรวจไม่สำเร็จ");
      setStatus($("proxy-status"), err.message || String(err), "err");
    } finally {
      setBtnLoading($("proxy-check-btn"), false);
    }
  }

  function renderUsers(users) {
    const body = $("users-body");
    const cards = $("users-cards");
    const filtered = users || getFilteredUsers();
    const list = filtered.slice(0, usersVisibleLimit);
    const moreWrap = $("users-more-wrap");
    if (moreWrap) {
      moreWrap.classList.toggle("hidden", filtered.length <= usersVisibleLimit);
    }
    syncSortHeaders();

    if (body) {
      if (!list.length) {
        body.innerHTML = emptyUsersHtml(true);
      } else {
        body.innerHTML = list
          .map((u) => {
            const st = rentalStatus(u);
            return (
              '<tr data-user-id="' +
              escapeHtml(u.id || "") +
              '" data-username="' +
              escapeHtml(u.username || "") +
              '" tabindex="0" role="button">' +
              '<td data-label="ชื่อผู้ใช้"><div class="user-cell"><strong class="user-name">' +
              escapeHtml(u.username || "—") +
              '</strong><button type="button" class="copy-btn" data-copy="' +
              escapeHtml(u.username || "") +
              '" title="คัดลอก" aria-label="คัดลอก">คัดลอก</button></div></td><td data-label="สมัครเมื่อ" class="muted">' +
              escapeHtml(formatDay(u.created_at)) +
              '</td><td data-label="หมดอายุ" class="muted">' +
              escapeHtml(formatExpiryCell(u)) +
              '</td><td data-label="Token"><strong>' +
              escapeHtml(String(u.token_balance ?? 0)) +
              '</strong></td><td data-label="สถานะ"><span class="tag tag-' +
              st.kind +
              '">' +
              escapeHtml(st.label) +
              '</span></td><td data-label=""><button type="button" class="btn btn-ghost btn-sm" data-action="open-drawer">จัดการ</button></td></tr>'
            );
          })
          .join("");
      }
    }

    if (cards) {
      if (!list.length) {
        cards.innerHTML = emptyUsersHtml(false);
      } else {
        cards.innerHTML = list
          .map((u) => {
            const st = rentalStatus(u);
            return (
              '<article class="user-card" data-user-id="' +
              escapeHtml(u.id || "") +
              '" tabindex="0" role="button"><div class="user-card-head"><strong>' +
              escapeHtml(u.username || "—") +
              '</strong><span class="tag tag-' +
              st.kind +
              '">' +
              escapeHtml(st.label) +
              '</span></div><div class="user-card-meta"><span>สมัคร: ' +
              escapeHtml(formatDay(u.created_at)) +
              "</span><span>หมดอายุ: " +
              escapeHtml(formatExpiryCell(u)) +
              "</span><span>Token: " +
              escapeHtml(String(u.token_balance ?? 0)) +
              "</span></div></article>"
            );
          })
          .join("");
      }
    }
    paintKpis();
  }

  async function loadUsers() {
    const listStatus = $("list-status");
    const body = $("users-body");
    const cards = $("users-cards");
    if (PREVIEW_MODE) {
      cachedUsers = PREVIEW_USERS.map((u) => ({ ...u }));
      usersVisibleLimit = USERS_PAGE;
      renderUsers();
      paintKpis();
      if (listStatus) {
        listStatus.textContent = "ข้อมูลจำลองสำหรับ Preview เท่านั้น";
        listStatus.className = "status muted";
      }
      return;
    }
    if (body) body.innerHTML = skeletonHtml("table");
    if (cards) cards.innerHTML = skeletonHtml("cards");
    try {
      let users = null;
      if (isEdgeRentalMode()) {
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
      usersVisibleLimit = USERS_PAGE;
      renderUsers();
      paintKpis();
      if (listStatus) {
        listStatus.textContent = "";
        listStatus.className = "status muted";
      }
    } catch (e) {
      if (body) body.innerHTML = "";
      setStatus(listStatus, e.message, "err");
    }
  }

  async function showDash(profile) {
    loginPanel.classList.add("hidden");
    dash.classList.remove("hidden");
    $("preview-banner")?.classList.toggle("hidden", !PREVIEW_MODE);
    adminId = profile.id || null;
    const whoName = profile.username || profile.display_name || "admin";
    if ($("who-user")) $("who-user").textContent = whoName;
    if ($("who-user-mobile")) $("who-user-mobile").textContent = whoName;
    setMode(adminMode);
    showView("overview");
    showCashierTab("create");
    await Promise.all([
      loadUsers(),
      loadStuckTopups(),
      loadAudit(),
      loadStats(),
      loadSettings(),
      loadAdminTopupPackages(),
    ]);
  }

  function showLogin() {
    stopMonitorPolling();
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

  /* ---- Command palette ---- */
  function buildCmdItems(q) {
    const query = (q || "").trim().toLowerCase();
    const items = [];
    const cmds = [
      { id: "cmd-create", label: "สร้างบัญชี", meta: "แคชเชียร์", run: () => openRentalTask("create") },
      { id: "cmd-extend", label: "ต่ออายุ", meta: "แคชเชียร์", run: () => openRentalTask("extend") },
      { id: "cmd-users", label: "ไปหน้าผู้ใช้", meta: "นำทาง", run: () => showView("users") },
      { id: "cmd-monitor", label: "ไปหน้า Live Monitor", meta: "นำทาง", run: () => showView("monitor") },
      { id: "cmd-overview", label: "ไปหน้าภาพรวม", meta: "นำทาง", run: () => showView("overview") },
      { id: "cmd-system", label: "ไปหน้าระบบ", meta: "นำทาง", run: () => showView("system") },
      {
        id: "cmd-mode",
        label: "สลับโหมด PC / Powder / Web / Invite",
        meta: "โหมด",
        run: () =>
          setMode(
            adminMode === "day"
              ? "powder"
              : adminMode === "powder"
                ? "web"
                : adminMode === "web"
                  ? "invite"
                  : "day"
          ),
      },
      {
        id: "cmd-invite-credit",
        label: "ปรับ Invite Credit",
        meta: "แคชเชียร์",
        run: () => {
          setMode("invite");
          showView("cashier");
          $("invite-credit-q")?.focus();
        },
      },
      { id: "cmd-refresh", label: "รีเฟรชข้อมูล", meta: "ระบบ", run: () => Promise.all([loadUsers(), loadStats(), loadAudit(), loadStuckTopups(), loadSettings(), loadAdminTopupPackages()]) },
      {
        id: "cmd-early-access",
        label: "เข้าถึงก่อนใคร",
        meta: "ระบบ",
        run: () => {
          showView("system");
          $("early-access-feature")?.focus();
        },
      },
    ];
    cmds.forEach((c) => {
      if (!query || c.label.toLowerCase().includes(query) || c.meta.toLowerCase().includes(query)) {
        items.push(c);
      }
    });
    cachedUsers
      .filter((u) => !query || String(u.username || "").toLowerCase().includes(query))
      .slice(0, 12)
      .forEach((u) => {
        const st = rentalStatus(u);
        items.push({
          id: "user-" + u.id,
          label: u.username || "—",
          meta: st.label,
          run: () => {
            showView("users");
            openUserDrawer(u.id);
          },
        });
      });
    return items;
  }

  function paintCmdList() {
    const list = $("cmd-list");
    if (!list) return;
    if (!cmdItems.length) {
      list.innerHTML = '<div class="empty-state"><strong>ไม่พบผลลัพธ์</strong></div>';
      return;
    }
    list.innerHTML = cmdItems
      .map(
        (item, i) =>
          '<button type="button" class="cmd-item' +
          (i === cmdActiveIndex ? " is-active" : "") +
          '" data-cmd-index="' +
          i +
          '" role="option" aria-selected="' +
          (i === cmdActiveIndex ? "true" : "false") +
          '"><span>' +
          escapeHtml(item.label) +
          '</span><span class="cmd-item-meta">' +
          escapeHtml(item.meta || "") +
          "</span></button>"
      )
      .join("");
  }

  function openCommandPalette() {
    if (!cmdRoot || !dash || dash.classList.contains("hidden")) return;
    cmdItems = buildCmdItems("");
    cmdActiveIndex = 0;
    paintCmdList();
    if (!overlayStack.some((x) => x.el === cmdRoot)) {
      openOverlay(cmdRoot, { initialFocus: $("cmd-input") });
    } else {
      cmdRoot.classList.remove("hidden");
      cmdRoot.classList.add("is-open");
    }
    if ($("cmd-input")) $("cmd-input").value = "";
  }

  function closeCommandPalette() {
    if (cmdRoot) closeOverlay(cmdRoot);
  }

  function runCmdItem(index) {
    const item = cmdItems[index];
    if (!item) return;
    closeCommandPalette();
    item.run();
  }

  function handleCmdKeydown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      cmdActiveIndex = Math.min(cmdItems.length - 1, cmdActiveIndex + 1);
      paintCmdList();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      cmdActiveIndex = Math.max(0, cmdActiveIndex - 1);
      paintCmdList();
    } else if (e.key === "Enter") {
      e.preventDefault();
      runCmdItem(cmdActiveIndex);
    }
  }

  function applyDensity(mode) {
    const compact = mode === "compact";
    dash?.classList.toggle("density-compact", compact);
    try {
      localStorage.setItem(DENSITY_KEY, compact ? "compact" : "comfortable");
    } catch (_) {}
    const btn = $("density-btn");
    if (btn) btn.textContent = compact ? "หนาแน่น: แน่น" : "หนาแน่น: สบาย";
  }

  function applyTheme(theme) {
    const light = theme === "light";
    document.body?.classList.toggle("theme-light", light);
    document.body?.classList.toggle("theme-dark", !light);
    try {
      localStorage.setItem(THEME_KEY, light ? "light" : "dark");
    } catch (_) {}
    const btn = $("theme-btn");
    if (btn) {
      btn.textContent = light ? "โหมดมืด" : "โหมดสว่าง";
      btn.title = light ? "เปลี่ยนเป็น Dark mode" : "เปลี่ยนเป็น Light mode";
      btn.setAttribute("aria-pressed", light ? "false" : "true");
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", light ? "#f5f5f5" : "#090909");
  }

  function clearUserFilters() {
    userFilter = "all";
    userSearch = "";
    usersVisibleLimit = USERS_PAGE;
    if ($("users-search")) $("users-search").value = "";
    $("users-search-clear")?.setAttribute("hidden", "");
    document.querySelectorAll("[data-user-filter]").forEach((b) => {
      const on = b.getAttribute("data-user-filter") === "all";
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    renderUsers();
  }

  /* ---- Events ---- */
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.getAttribute("data-view")));
  });

  $("mode-day")?.addEventListener("click", () => setMode("day"));
  $("mode-powder")?.addEventListener("click", () => setMode("powder"));
  $("mode-web")?.addEventListener("click", () => setMode("web"));
  $("mode-invite")?.addEventListener("click", () => setMode("invite"));

  $("invite-credit-lookup-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const q = String($("invite-credit-q")?.value || "").trim();
    if (!q) return;
    try {
      inviteCreditUser = await lookupUserToBox(q, "invite-credit-result", "invite-credit-q");
      if ($("invite-credit-result") && inviteCreditUser) {
        $("invite-credit-result").innerHTML = describeInviteCreditUser(inviteCreditUser);
      }
      setStatus($("invite-credit-status"), "", "muted");
    } catch (err) {
      inviteCreditUser = null;
      setStatus($("invite-credit-status"), err.message || String(err), "err");
    }
  });

  document.querySelectorAll("[data-invite-delta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if ($("invite-credit-delta")) {
        $("invite-credit-delta").value = btn.getAttribute("data-invite-delta") || "14";
      }
    });
  });

  $("invite-credit-form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const username = String(
      inviteCreditUser?.username || $("invite-credit-q")?.value || ""
    ).trim();
    const delta = Number($("invite-credit-delta")?.value || 0);
    const reason = String($("invite-credit-reason")?.value || "").trim() || "admin_grant";
    if (!username) {
      setStatus($("invite-credit-status"), "ค้นหาชื่อผู้ใช้ก่อน", "err");
      return;
    }
    if (!delta) {
      setStatus($("invite-credit-status"), "ใส่จำนวน Credit ที่ไม่เป็น 0", "err");
      return;
    }
    const confirmed = await showConfirmModal({
      title: delta > 0 ? "เพิ่ม Invite Credit?" : "ลด Invite Credit?",
      body:
        (delta > 0 ? "เพิ่ม +" : "ลด ") +
        delta +
        " Credit ให้ " +
        username +
        " ?",
      confirmLabel: "ยืนยัน",
      cancelLabel: "ยกเลิก",
      danger: delta < 0,
    });
    if (!confirmed) return;
    setBtnLoading($("invite-credit-grant-btn"), true);
    try {
      const data = await api("/api/admin/invite-credit/grant", {
        method: "POST",
        body: {
          username,
          user_id: inviteCreditUser?.id || undefined,
          delta,
          reason,
        },
      });
      inviteCreditUser = {
        ...(inviteCreditUser || {}),
        id: data.user_id || inviteCreditUser?.id,
        username: data.username || username,
        invite_credit_balance: data.invite_credit_balance,
      };
      if ($("invite-credit-result")) {
        $("invite-credit-result").className = "lookup-box";
        $("invite-credit-result").innerHTML = describeInviteCreditUser(inviteCreditUser);
      }
      setStatus(
        $("invite-credit-status"),
        (delta > 0 ? "เพิ่ม +" : "ลด ") +
          delta +
          " สำเร็จ · คงเหลือ " +
          data.invite_credit_balance +
          " Credit",
        "ok"
      );
      paintReceipt([
        delta > 0 ? "เพิ่ม Invite Credit" : "ลด Invite Credit",
        "User: " + (data.username || username),
        "Delta: " + (delta > 0 ? "+" : "") + delta,
        "คงเหลือ: " + data.invite_credit_balance + " Credit",
        "เหตุผล: " + reason,
      ]);
      await loadAudit();
    } catch (err) {
      setStatus($("invite-credit-status"), err.message || String(err), "err");
    } finally {
      setBtnLoading($("invite-credit-grant-btn"), false);
    }
  });

  function onUserRowActivate(el) {
    if (!el) return;
    openUserDrawer(el.getAttribute("data-user-id"));
  }

  $("users-body")?.addEventListener("click", (e) => {
    const clearBtn = e.target.closest('[data-action="clear-filters"]');
    if (clearBtn) {
      e.preventDefault();
      clearUserFilters();
      return;
    }
    const createBtn = e.target.closest('[data-action="goto-create"]');
    if (createBtn) {
      showView("cashier");
      showCashierTab("create");
      return;
    }
    const copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) {
      e.stopPropagation();
      copyText(copyBtn.getAttribute("data-copy") || "").then((ok) => {
        if (ok) {
          copyBtn.classList.add("is-copied");
          toast("คัดลอกแล้ว", "ok");
          setTimeout(() => copyBtn.classList.remove("is-copied"), 1200);
        }
      });
      return;
    }
    const row = e.target.closest("[data-user-id]");
    if (!row) return;
    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn?.getAttribute("data-action") === "open-drawer" || !actionBtn) {
      onUserRowActivate(row);
    }
  });

  $("users-body")?.addEventListener("keydown", (e) => {
    const row = e.target.closest("tr[data-user-id]");
    if (!row) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onUserRowActivate(row);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      row.nextElementSibling?.focus?.();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      row.previousElementSibling?.focus?.();
    }
  });

  $("users-cards")?.addEventListener("click", (e) => {
    const clearBtn = e.target.closest('[data-action="clear-filters"]');
    if (clearBtn) {
      clearUserFilters();
      return;
    }
    const createBtn = e.target.closest('[data-action="goto-create"]');
    if (createBtn) {
      showView("cashier");
      showCashierTab("create");
      return;
    }
    const card = e.target.closest("[data-user-id]");
    if (card) onUserRowActivate(card);
  });

  $("users-cards")?.addEventListener("keydown", (e) => {
    const card = e.target.closest("[data-user-id]");
    if (!card) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onUserRowActivate(card);
    }
  });

  $("drawer-close")?.addEventListener("click", closeUserDrawer);
  $("drawer-backdrop")?.addEventListener("click", closeUserDrawer);
  $("drawer-body")?.addEventListener("click", (e) => {
    const copyBtn = e.target.closest("[data-copy]");
    if (!copyBtn) return;
    copyText(copyBtn.getAttribute("data-copy") || "").then((ok) => {
      if (ok) toast("คัดลอกแล้ว", "ok");
    });
  });

  document.querySelectorAll("[data-user-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      userFilter = btn.getAttribute("data-user-filter") || "all";
      usersVisibleLimit = USERS_PAGE;
      document.querySelectorAll("[data-user-filter]").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      renderUsers();
    });
  });

  const onUsersSearch = debounce((value) => {
    userSearch = value.trim();
    usersVisibleLimit = USERS_PAGE;
    renderUsers();
  }, 150);

  $("users-search")?.addEventListener("input", (e) => {
    const v = e.target.value;
    $("users-search-clear")?.toggleAttribute("hidden", !v);
    onUsersSearch(v);
  });

  $("users-search-clear")?.addEventListener("click", () => {
    if ($("users-search")) $("users-search").value = "";
    $("users-search-clear")?.setAttribute("hidden", "");
    userSearch = "";
    usersVisibleLimit = USERS_PAGE;
    renderUsers();
    $("users-search")?.focus();
  });

  $("users-sort")?.addEventListener("change", (e) => {
    userSort = e.target.value || "created_desc";
    renderUsers();
  });

  $("users-table")?.querySelector("thead")?.addEventListener("click", (e) => {
    const th = e.target.closest("th[data-sort-key]");
    if (!th) return;
    const key = th.getAttribute("data-sort-key");
    if (key === "name") userSort = "name_asc";
    else if (key === "created") {
      userSort = userSort === "created_desc" ? "created_asc" : "created_desc";
    } else if (key === "expires") {
      userSort = userSort === "expires_asc" ? "expires_desc" : "expires_asc";
    }
    renderUsers();
  });

  $("users-table")?.querySelector("thead")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const th = e.target.closest("th[data-sort-key]");
    if (!th) return;
    e.preventDefault();
    th.click();
  });

  $("users-more-btn")?.addEventListener("click", () => {
    usersVisibleLimit += USERS_PAGE;
    renderUsers();
  });

  $("export-csv-btn")?.addEventListener("click", () => exportUsersCsv());

  const onAuditSearch = debounce(() => paintAuditList(), 150);
  $("audit-search")?.addEventListener("input", (e) => {
    $("audit-search-clear")?.toggleAttribute("hidden", !e.target.value);
    onAuditSearch();
  });
  $("audit-search-clear")?.addEventListener("click", () => {
    if ($("audit-search")) $("audit-search").value = "";
    $("audit-search-clear")?.setAttribute("hidden", "");
    paintAuditList();
    $("audit-search")?.focus();
  });
  $("audit-filter")?.addEventListener("change", () => paintAuditList());

  $("cmd-open-btn")?.addEventListener("click", openCommandPalette);
  $("cmd-backdrop")?.addEventListener("click", closeCommandPalette);
  $("cmd-input")?.addEventListener("input", (e) => {
    cmdItems = buildCmdItems(e.target.value);
    cmdActiveIndex = 0;
    paintCmdList();
  });
  $("cmd-list")?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-cmd-index]");
    if (!item) return;
    runCmdItem(Number(item.getAttribute("data-cmd-index")));
  });

  $("density-btn")?.addEventListener("click", () => {
    const compact = !dash?.classList.contains("density-compact");
    applyDensity(compact ? "compact" : "comfortable");
  });

  $("theme-btn")?.addEventListener("click", () => {
    applyTheme(document.body?.classList.contains("theme-light") ? "dark" : "light");
  });

  try {
    applyDensity(localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable");
  } catch (_) {
    applyDensity("comfortable");
  }
  try {
    applyTheme(localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");
  } catch (_) {
    applyTheme("dark");
  }

  document.querySelectorAll("[data-cashier-tab]").forEach((btn) => {
    btn.addEventListener("click", () =>
      showCashierTab(btn.getAttribute("data-cashier-tab"))
    );
  });

  $("overview-alerts")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-alert-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-alert-action");
    if (action === "system") showView("system");
    if (action === "stuck") {
      showView("system");
      document.querySelector(".mode-web-only")?.scrollIntoView({ behavior: "smooth" });
    }
    if (action === "users-expire") {
      userFilter = "active";
      usersVisibleLimit = USERS_PAGE;
      document.querySelectorAll("[data-user-filter]").forEach((b) => {
        const on = b.getAttribute("data-user-filter") === "active";
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      showView("users");
      renderUsers();
    }
  });

  document.querySelectorAll("[data-shortcut]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const s = btn.getAttribute("data-shortcut");
      if (s === "search-user") {
        showView("users");
        $("users-search")?.focus();
      }
      if (s === "create-user") {
        openRentalTask("create");
      }
      if (s === "extend-user") {
        openRentalTask("extend");
        $("extend-q")?.focus();
      }
      if (s === "credit-user") {
        setMode("invite");
        showView("cashier");
        $("invite-credit-q")?.focus();
      }
      if (s === "stuck-topups") {
        showView("system");
      }
    });
  });

  $("refresh-overview-btn")?.addEventListener("click", async () => {
    await Promise.all([loadUsers(), loadStats(), loadAudit(), loadStuckTopups(), loadSettings(), loadAdminTopupPackages()]);
  });

  $("refresh-monitor-btn")?.addEventListener("click", () => loadMonitor());
  $("monitor-search")?.addEventListener("input", () => renderMonitor());
  $("monitor-status-filter")?.addEventListener("change", () => renderMonitor());
  function handleMonitorJobLogClick(e) {
    const summary = e.target.closest("[data-monitor-job-log]");
    if (!summary) return;
    const details = summary.closest("details");
    const jobId = summary.getAttribute("data-monitor-job-log");
    window.setTimeout(() => {
      if (details?.open) loadMonitorJobLog(jobId);
    }, 0);
  }
  $("view-monitor")?.addEventListener("click", handleMonitorJobLogClick);
  $("drawer-body")?.addEventListener("click", handleMonitorJobLogClick);
  $("view-monitor")?.addEventListener("click", (e) => {
    const button = e.target.closest("[data-monitor-user]");
    if (!button) return;
    const userId = button.getAttribute("data-monitor-user");
    if (!userId) return;
    showView("users");
    openUserDrawer(userId);
  });

  $("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setBtnLoading($("login-btn"), true);
    setStatus($("login-status"), "กำลังเข้าสู่ระบบ…", "muted");
    try {
      setRememberMePreference(!!$("remember-me")?.checked);
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
      if ($("login-status")) {
        $("login-status").textContent = "";
        $("login-status").className = "status muted";
      }
      await showDash(data.profile);
      toast("เข้าสู่ระบบแล้ว", "ok");
    } catch (err) {
      setStatus($("login-status"), err.message || String(err), "err");
      showLogin();
    } finally {
      setBtnLoading($("login-btn"), false);
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

  $("preview-exit-btn")?.addEventListener("click", () => {
    if (PREVIEW_MODE) {
      location.href = location.pathname;
    } else {
      showLogin();
    }
  });

  $("refresh-btn")?.addEventListener("click", () => loadUsers());
  $("refresh-stuck-btn")?.addEventListener("click", () => loadStuckTopups());
  $("refresh-audit-btn")?.addEventListener("click", () => loadAudit());
  $("invite-pool-refresh-btn")?.addEventListener("click", () => loadInvitePoolStats());
  $("invite-pool-merge-btn")?.addEventListener("click", () => mergeInvitePool());
  $("invite-pool-clear-ready-btn")?.addEventListener("click", () =>
    clearInvitePool("ready", false)
  );
  $("invite-pool-clear-all-btn")?.addEventListener("click", () =>
    clearInvitePool("all", false)
  );
  $("invite-pool-file")?.addEventListener("change", async (ev) => {
    const file = ev.target?.files?.[0];
    if (!file || !$("invite-pool-text")) return;
    try {
      $("invite-pool-text").value = await file.text();
      setStatus($("invite-pool-status"), "โหลดไฟล์แล้ว — กด Merge เพื่อบันทึก", "muted");
    } catch (err) {
      setStatus($("invite-pool-status"), err.message || String(err), "err");
    }
  });

  $("early-access-feature")?.addEventListener("change", () => {
    paintEarlyAccessEditor();
    setStatus($("early-access-status"), "", "muted");
  });
  $("save-early-access-btn")?.addEventListener("click", async () => {
    setBtnLoading($("save-early-access-btn"), true);
    setStatus($("early-access-status"), "กำลังบันทึก…", "muted");
    try {
      const msg = await saveEarlyAccess();
      setStatus($("early-access-status"), msg, "ok");
      loadAudit().catch(() => {});
    } catch (err) {
      const data = err?.data?.detail;
      let msg = err.message || String(err);
      if (data && typeof data === "object" && Array.isArray(data.usernames) && data.usernames.length) {
        msg = "ไม่พบ username: " + data.usernames.join(", ");
      }
      setStatus($("early-access-status"), msg, "err");
    } finally {
      setBtnLoading($("save-early-access-btn"), false);
    }
  });

  bindFeatureOrderDrag();
  $("save-settings-btn")?.addEventListener("click", async () => {
    setBtnLoading($("save-settings-btn"), true);
    setStatus($("settings-status"), "กำลังบันทึก…", "muted");
    try {
      const payload = readSettingsPayloadFromUi();
      const response = await api("/api/admin/settings", {
        method: "POST",
        body: payload,
      });
      settingsCache = normalizeSettings(
        response?.settings || response,
        normalizeSettings({ ...settingsCache, ...payload }, settingsCache)
      );
      paintSettingsControls(settingsCache);
      featureOrderState = normalizeFarmFeatureOrder(settingsCache.farm_feature_order);
      featureCatalogState = normalizeFeatureCatalog(settingsCache.feature_catalog);
      paintFeatureOrderList();
      paintFeatureLockToggles(settingsCache.feature_locks);
      paintAfterplayProfiles(settingsCache);
      persistSettingsSnapshot(settingsCache);
      paintSettingsControls(settingsCache);
      setStatus($("settings-status"), "บันทึกแล้ว", "ok");
      await loadAudit();
    } catch (err) {
      setStatus($("settings-status"), err.message || String(err), "err");
    } finally {
      setBtnLoading($("save-settings-btn"), false);
    }
  });

  $("refresh-topup-packages-btn")?.addEventListener("click", () => loadAdminTopupPackages());
  $("add-topup-package-btn")?.addEventListener("click", () => {
    const next = adminTopupPackages.length + 1;
    adminTopupPackages.push({
      id: "full_custom_" + Date.now(),
      kind: "full",
      label_th: next + " วัน",
      price_baht: 200,
      days: next,
      hours: next * 24,
      active: true,
    });
    renderAdminTopupPackages();
    const root = $("topup-packages-admin-list");
    root?.lastElementChild?.querySelector('[data-package-field="label_th"]')?.focus();
  });
  $("topup-packages-admin-list")?.addEventListener("change", (event) => {
    const row = event.target?.closest?.("[data-package-index]");
    if (row && event.target?.getAttribute("data-package-field") === "kind") {
      syncAdminTopupRow(row);
    }
  });
  $("save-topup-packages-btn")?.addEventListener("click", async () => {
    const btn = $("save-topup-packages-btn");
    setBtnLoading(btn, true);
    setStatus($("topup-packages-status"), "กำลังบันทึกแพ็ก…", "muted");
    try {
      await saveAdminTopupPackages();
      setStatus($("topup-packages-status"), "บันทึกแพ็กแล้ว · ราคาใหม่มีผลกับ TrueMoney และหน้าเว็บ", "ok");
    } catch (err) {
      setStatus($("topup-packages-status"), err.message || String(err), "err");
    } finally {
      setBtnLoading(btn, false);
    }
  });

  document.querySelectorAll("[data-ap-profile-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setApProfileTab(btn.getAttribute("data-ap-profile-tab")));
  });
  $("save-afterplay-profiles-btn")?.addEventListener("click", async () => {
    setBtnLoading($("save-afterplay-profiles-btn"), true);
    setStatus($("ap-profile-status"), "กำลังบันทึก…", "muted");
    try {
      const payload = readAfterplayProfilesFromUi();
      const response = await api("/api/admin/settings", {
        method: "POST",
        body: payload,
      });
      settingsCache = normalizeSettings(response?.settings || response, {
        ...settingsCache,
        ...payload,
      });
      paintAfterplayProfiles(settingsCache);
      persistSettingsSnapshot(settingsCache);
      setStatus($("ap-profile-status"), "บันทึกโปรไฟล์แล้ว", "ok");
      await loadAudit();
    } catch (err) {
      setStatus($("ap-profile-status"), err.message || String(err), "err");
    } finally {
      setBtnLoading($("save-afterplay-profiles-btn"), false);
    }
  });

  $("proxy-apply-btn")?.addEventListener("click", () => applyAdminProxy());
  $("heart-socks-apply-btn")?.addEventListener("click", () => applyHeartSocks());
  $("webshare-token-apply-btn")?.addEventListener("click", () => applyWebshareToken());
  $("proxy-check-btn")?.addEventListener("click", () => checkAdminProxy());
  $("heart-helpers-refresh-btn")?.addEventListener("click", () => loadHeartHelpers());
  $("heart-helpers-merge-btn")?.addEventListener("click", () => mergeHeartHelpers());
  $("heart-helpers-download-btn")?.addEventListener("click", () => downloadHeartHelpers());
  $("heart-helpers-file")?.addEventListener("change", async (ev) => {
    const file = ev.target?.files?.[0];
    if (!file || !$("heart-helpers-text")) return;
    try {
      $("heart-helpers-text").value = await file.text();
      setStatus($("heart-helpers-status"), "โหลดไฟล์แล้ว — กด Add/Merge เพื่อบันทึก", "muted");
    } catch (err) {
      setStatus($("heart-helpers-status"), err.message || String(err), "err");
    }
  });
  $("proxy-show-btn")?.addEventListener("click", () => {
    const input = $("admin-proxy-url");
    const tokenInput = $("admin-webshare-token");
    const socksInput = $("admin-heart-socks-url");
    const btn = $("proxy-show-btn");
    if (!input && !tokenInput && !socksInput) return;
    const show = (input || tokenInput || socksInput).type === "password";
    if (input) input.type = show ? "text" : "password";
    if (tokenInput) tokenInput.type = show ? "text" : "password";
    if (socksInput) socksInput.type = show ? "text" : "password";
    if (btn) btn.textContent = show ? "ซ่อน" : "แสดง";
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
    setBtnLoading($("create-btn"), true);
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
      setBtnLoading($("create-btn"), false);
    }
  });

  $("extend-lookup-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("extend-q").value.trim();
    try {
      await lookupUserToBox(q, "extend-result", "extend-q");
    } catch (_) {}
  });

  $("expires-lookup-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = $("expires-q").value.trim();
    try {
      await lookupUserToBox(q, "expires-result", "expires-q");
    } catch (_) {}
  });

  $("extend-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setBtnLoading($("extend-btn"), true);
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
      setBtnLoading($("extend-btn"), false);
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
    setBtnLoading($("revoke-btn"), true);
    try {
      const data = await applyRentalChange({ username, revoke: true });
      const u = data.user || { username };
      setStatus($("extend-status"), "ตัดสิทธิ์แล้ว: " + (u.username || username), "ok");
      paintReceipt(["ตัดสิทธิ์", "User: " + (u.username || username)]);
      await loadUsers();
    } catch (err) {
      setStatus($("extend-status"), err.message || String(err), "err");
    } finally {
      setBtnLoading($("revoke-btn"), false);
    }
  });

  $("set-expires-btn")?.addEventListener("click", async () => {
    const username = ($("expires-q")?.value || $("extend-q")?.value || "").trim();
    if (!username) {
      setStatus($("expires-status"), "ใส่ชื่อผู้ใช้ก่อน", "err");
      return;
    }
    setBtnLoading($("set-expires-btn"), true);
    setStatus($("expires-status"), "กำลังตั้งวันหมดอายุ…", "muted");
    try {
      const expiresAtIso = parseDatetimeLocal($("extend-expires-at")?.value);
      if (!expiresAtIso) throw new Error("เลือกวันและเวลาหมดอายุ");
      const data = await setRentalExpiresAt({ username, expiresAtIso });
      const u = enrichUser(data.user || { username });
      const st = rentalStatus(u);
      setStatus(
        $("expires-status"),
        "ตั้งหมดอายุแล้ว: " + (u.username || username) + " · " + st.label,
        "ok"
      );
      paintReceipt([
        "ตั้งวันหมดอายุ",
        "User: " + (u.username || username),
        "หมดอายุ: " + rentalReceiptExpiry(u),
      ]);
      if ($("expires-result")) {
        $("expires-result").className = "lookup-box";
        $("expires-result").innerHTML = describeRentalUser(u);
      }
      await loadUsers();
    } catch (err) {
      setStatus($("expires-status"), err.message || String(err), "err");
    } finally {
      setBtnLoading($("set-expires-btn"), false);
    }
  });

  syncRememberMeControl();
  sessionToken = loadStoredSessionToken();
  pingApiHealth(2).catch(() => {});

  (async () => {
    if (PREVIEW_MODE) {
      accessToken = "local-preview";
      sessionToken = "local-preview";
      await showDash(PREVIEW_PROFILE);
      return;
    }
    const ctx = await requireAdminSession();
    if (ctx) await showDash(ctx.profile);
  })();
})();
