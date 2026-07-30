# CKR Admin Console (Login_j3xdr)

แดชบอร์ดแอดมินแบบ POS — สลับโหมดระหว่าง **เช่าวัน (PC)** กับ **เช่าวัน (Web)**

## Preview ท้องถิ่น

```bash
cd Login_j3xdr
python -m http.server 5179 --bind 127.0.0.1
```

เปิด [http://127.0.0.1:5179/](http://127.0.0.1:5179/) (API local ใช้ `?api=local` หรือรัน uvicorn ที่พอร์ต 8787)

## โหมดการทำงาน

| โหมด | ใช้ทำ | Backend | ฟิลด์หมดอายุ |
|------|--------|---------|--------------|
| **เช่าวัน (PC)** | สร้างผู้ใช้, ต่ออายุ (วัน/ชม./นาที), ถาวร, ตัดสิทธิ์ | Supabase Edge `admin-register` + RPC `admin_extend_rental` | `expires_at` |
| **เช่าวัน (Web)** | สร้างผู้ใช้, ต่ออายุ, ถาวร, ตัดสิทธิ์, เติมค้าง | VPS `API_BASE` `/api/admin/rental/*` | `rental_expires_at` |

สวิตช์โหมดอยู่แถบบน — จำค่าล่าสุดใน `localStorage` (`ckr_admin_mode`)

## เมนู

- **ภาพรวม** — KPI + สถิติวันนี้  
- **ผู้ใช้** — ตารางสถานะเช่า  
- **แคชเชียร์** — สร้างบัญชี / ต่ออายุ / ถาวร / ตัดสิทธิ์ + แพ็ก 1·7·30 วัน, ทดลอง 1 ชม., ตั้งวันหมดอายุเอง  
- **ระบบ** — maintenance, audit, (โหมด Web) เติมค้าง  

## Deploy ที่จำเป็น (ครั้งแรก / หลังอัปเดต)

1. Apply SQL จาก `supabase/schema.sql` (หรือ migration ที่มี `admin_extend_rental`)  
2. Deploy Edge:

```bash
npx supabase functions deploy admin-register --project-ref <project-ref>
```

อย่าใส่ `service_role` ใน `config.js`

## Config

`config.js` มี anon key + `API_BASE` (`https://api.crgwwdc.shop`) สำหรับ login / admin Web rental
