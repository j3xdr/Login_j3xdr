// Public config — anon key only (RLS). Never put service_role here.
window.PARTYRUN_CONFIG = {
  SUPABASE_URL: "https://huugsgfpgqamnaejydkm.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dWdzZ2ZwZ3FhbW5hZWp5ZGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjYyNzAsImV4cCI6MjEwMDIwMjI3MH0.ioHMbJ7_Mcb3zwniZQLBJpiUvdm9RHKIlCgfHiicWoY",
  API_BASE: (() => {
    const prod = "https://api.crgwwdc.shop";
    const local = "http://127.0.0.1:8787";
    if (typeof location === "undefined") return prod;
    const host = location.hostname;
    const p = new URLSearchParams(location.search);
    if (p.get("api") === "prod") return prod;
    if (p.get("api") === "local") return local;
    const custom = p.get("api");
    if (custom && /^https?:\/\//i.test(custom)) return custom;
    if (host === "localhost" || host === "127.0.0.1") return local;
    return prod;
  })(),
};
