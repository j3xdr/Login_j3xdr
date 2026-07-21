/* PartyRun Admin — Login_j3xdr */
(function () {
  "use strict";

  const cfg = window.PARTYRUN_CONFIG;
  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
    document.body.innerHTML = "<p style='color:#f88;padding:2rem'>Missing config.js</p>";
    return;
  }

  const { createClient } = supabase;
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);
  const loginPanel = $("login-panel");
  const dash = $("dash");
  const loginStatus = $("login-status");
  const regStatus = $("reg-status");
  const listStatus = $("list-status");

  function setStatus(el, text, kind) {
    el.textContent = text || "";
    el.className = "status " + (kind || "muted");
  }

  function fmtExpiry(row) {
    if (row.is_permanent) return "ถาวร";
    if (!row.expires_at) return "—";
    const d = new Date(row.expires_at);
    const expired = d.getTime() < Date.now();
    const s = d.toLocaleString();
    return expired ? s + " (หมดแล้ว)" : s;
  }

  async function requireAdminSession() {
    const { data: sess } = await sb.auth.getSession();
    if (!sess?.session) return null;
    const uid = sess.session.user.id;
    const { data: profile, error } = await sb
      .from("profiles")
      .select("id, role, email, is_permanent")
      .eq("id", uid)
      .maybeSingle();
    if (error || !profile || profile.role !== "admin") {
      await sb.auth.signOut();
      return null;
    }
    return { session: sess.session, profile };
  }

  async function showDash(session, profile) {
    loginPanel.classList.add("hidden");
    dash.classList.remove("hidden");
    $("who-email").textContent = profile.email || session.user.email || session.user.id;
    await loadUsers();
  }

  function showLogin() {
    dash.classList.add("hidden");
    loginPanel.classList.remove("hidden");
  }

  async function loadUsers() {
    listStatus.textContent = "";
    const tbody = $("users-body");
    tbody.innerHTML = "<tr><td colspan='5' style='color:var(--muted)'>กำลังโหลด…</td></tr>";

    const { data, error } = await sb.rpc("admin_list_profiles");
    if (error) {
      tbody.innerHTML = "";
      setStatus(listStatus, error.message, "err");
      return;
    }
    if (!data?.length) {
      tbody.innerHTML = "<tr><td colspan='5' style='color:var(--muted)'>ยังไม่มีผู้ใช้</td></tr>";
      return;
    }

    tbody.innerHTML = "";
    for (const row of data) {
      const tr = document.createElement("tr");
      const device = row.device_id
        ? String(row.device_id).slice(0, 10) + "…"
        : "—";
      tr.innerHTML = `
        <td>${escapeHtml(row.email || row.id)}</td>
        <td><span class="role ${row.role}">${escapeHtml(row.role)}</span></td>
        <td>${escapeHtml(fmtExpiry(row))}</td>
        <td title="${escapeHtml(row.device_id || "")}">${escapeHtml(device)}</td>
        <td></td>
      `;
      const cell = tr.lastElementChild;
      if (row.role !== "admin") {
        const wrap = document.createElement("div");
        wrap.className = "row-actions";

        const extend = document.createElement("div");
        extend.className = "extend-inline";
        extend.innerHTML = `
          <input type="number" min="0" value="1" data-h title="ชม." />
          <input type="number" min="0" value="0" data-m title="นาที" />
          <button type="button" class="btn btn-ghost btn-sm" data-extend>ขยาย</button>
          <button type="button" class="btn btn-ghost btn-sm" data-perm>ถาวร</button>
          <button type="button" class="btn btn-danger btn-sm" data-del>ลบ</button>
        `;
        extend.querySelector("[data-extend]").addEventListener("click", async () => {
          const h = Number(extend.querySelector("[data-h]").value) || 0;
          const m = Number(extend.querySelector("[data-m]").value) || 0;
          await extendUser(row.id, h, m, 0, false);
        });
        extend.querySelector("[data-perm]").addEventListener("click", async () => {
          await extendUser(row.id, 0, 0, 0, true);
        });
        extend.querySelector("[data-del]").addEventListener("click", async () => {
          if (!confirm("ลบผู้ใช้นี้ถาวร?")) return;
          await deleteUser(row.id);
        });
        wrap.appendChild(extend);
        cell.appendChild(wrap);
      } else {
        cell.textContent = "—";
      }
      tbody.appendChild(tr);
    }
  }

  async function extendUser(id, h, m, s, permanent) {
    setStatus(listStatus, "กำลังอัปเดต…", "muted");
    const { data, error } = await sb.rpc("admin_extend_rental", {
      p_user_id: id,
      p_hours: h,
      p_minutes: m,
      p_seconds: s,
      p_permanent: permanent,
    });
    if (error || !data?.ok) {
      setStatus(listStatus, error?.message || data?.reason || "extend failed", "err");
      return;
    }
    setStatus(listStatus, "อัปเดตแล้ว", "ok");
    await loadUsers();
  }

  async function deleteUser(id) {
    setStatus(listStatus, "กำลังลบ…", "muted");
    const { data, error } = await sb.rpc("admin_delete_user", { p_user_id: id });
    if (error || !data?.ok) {
      setStatus(listStatus, error?.message || data?.reason || "delete failed", "err");
      return;
    }
    setStatus(listStatus, "ลบแล้ว", "ok");
    await loadUsers();
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("login-email").value.trim();
    const password = $("login-pass").value;
    $("login-btn").disabled = true;
    setStatus(loginStatus, "กำลังเข้าสู่ระบบ…", "muted");
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const ctx = await requireAdminSession();
      if (!ctx) {
        setStatus(loginStatus, "บัญชีนี้ไม่ใช่ Admin", "err");
        showLogin();
        return;
      }
      setStatus(loginStatus, "", "muted");
      await showDash(ctx.session, ctx.profile);
    } catch (err) {
      setStatus(loginStatus, err.message || String(err), "err");
    } finally {
      $("login-btn").disabled = false;
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    await sb.auth.signOut();
    showLogin();
    setStatus(loginStatus, "ออกจากระบบแล้ว", "muted");
  });

  $("refresh-btn").addEventListener("click", () => loadUsers());

  $("reg-perm").addEventListener("change", (e) => {
    const on = e.target.checked;
    ["reg-h", "reg-m", "reg-s"].forEach((id) => {
      $(id).disabled = on;
    });
  });

  $("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("reg-btn").disabled = true;
    setStatus(regStatus, "กำลังสร้างบัญชี…", "muted");
    try {
      const { data: sess } = await sb.auth.getSession();
      if (!sess?.session?.access_token) throw new Error("ไม่ได้ล็อกอิน");

      const permanent = $("reg-perm").checked;
      const payload = {
        email: $("reg-email").value.trim(),
        password: $("reg-pass").value,
        hours: Number($("reg-h").value) || 0,
        minutes: Number($("reg-m").value) || 0,
        seconds: Number($("reg-s").value) || 0,
        permanent,
        role: "normal",
      };

      const url = `${cfg.SUPABASE_URL}/functions/v1/${cfg.ADMIN_REGISTER_FN}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.session.access_token}`,
          apikey: cfg.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      setStatus(
        regStatus,
        `สร้างแล้ว: ${body.user.email}` +
          (body.user.is_permanent
            ? " (ถาวร)"
            : ` หมดอายุ ${new Date(body.user.expires_at).toLocaleString()}`),
        "ok",
      );
      $("register-form").reset();
      $("reg-h").value = "24";
      ["reg-h", "reg-m", "reg-s"].forEach((id) => ($(id).disabled = false));
      await loadUsers();
    } catch (err) {
      setStatus(regStatus, err.message || String(err), "err");
    } finally {
      $("reg-btn").disabled = false;
    }
  });

  // Boot
  (async () => {
    const ctx = await requireAdminSession();
    if (ctx) await showDash(ctx.session, ctx.profile);
  })();
})();
