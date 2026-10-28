# Prompt: hubungkan satu divisi lagi ke hub dan server

Salin seluruh isi bagian "Prompt" di bawah ke Claude Code, ganti `<SLUG>` dan tiga nilai proyek. Jalankan sekali per divisi (EE, HR, FnL, SnG, Cons). MCIT sudah dikerjakan sebagai percobaan dan dijadikan contoh pola.

## Sebelum menjalankan (kamu)

1. Pemegang akun membuat proyek Supabase baru untuk divisi itu (misalnya `dwdg-hr`). Satu organisasi gratis hanya boleh 2 proyek aktif, jadi pakai organisasi lain atau paket Pro.
2. Ambil dari dashboard proyek itu:
   - **Project URL**: Project Settings → API (`https://xxxx.supabase.co`).
   - **Secret key** (`sb_secret_...`): API Keys.
3. Slug divisi: `ee`, `hr`, `fnl`, `sng`, atau `cons` (huruf kecil).

## Prompt

```
Hubungkan divisi <SLUG> ke hub dan server, lalu uji end-to-end. Ikuti pola yang sudah dipakai untuk MCIT
(docs/deployment/PROMPT-ADD-DIVISION.md). Baca AGENTS.md, CLAUDE.md dan memori proyek dulu.

Nilai proyek divisi <SLUG>:
- URL: <https://xxxx.supabase.co>
- Secret key: <sb_secret_...>

Yang harus kamu kerjakan, berurutan, dan berhenti untuk bertanya hanya kalau ada yang tidak jelas:

1. Simpan ke scripts/.env.local sebagai SUPABASE_URL_<SLUG huruf besar> dan SUPABASE_SERVICE_KEY_<SLUG huruf besar>,
   dan ke server/.env.local sebagai SPOKE_<SLUG>_URL dan SPOKE_<SLUG>_SERVICE_KEY. Kedua file di-gitignore; pastikan
   dengan `git check-ignore`. Jangan menampilkan key di keluaran.
2. Jalankan `npm run db:bundle`, lalu periksa apakah proyek itu masih kosong (tabel schema_meta belum ada). Kalau
   kosong, minta aku menempel database/bundles/<SLUG>.sql di SQL Editor proyek itu (atau kalau aku memberi connection
   string Postgres, jalankan sendiri). Bundle hanya untuk proyek kosong dan tidak boleh dijalankan dua kali.
3. Verifikasi: baca tabel schema_meta, row_tables dan semua tabel <SLUG>_* lewat supabase-js dengan service key.
4. Isi data demo: `node --env-file=scripts/.env.local scripts/database/move-data.mjs --demo --target spoke:<SLUG>`
   (mode periksa dulu), tampilkan hasilnya, lalu ulangi dengan `--apply`. Hub sudah berisi data demo dari MCIT; kalau
   hub belum, sertakan `--target hub,spoke:<SLUG> --allow-extra` (ada akun asli di hub; jangan pernah menghapusnya).
5. Beri tahu aku untuk menjalankan di SQL Editor HUB:
       update public.divisions set is_active = true where id = '<SLUG>';
   (service key tidak punya izin mengubah tabel divisions). Tunggu aku bilang sudah.
6. Mulai ulang server (`npm run dev -w server`, simpan log di scratchpad) dan cek `GET /api/health`.
7. Uji end-to-end lewat server dengan skrip sementara di scratchpad (jangan masuk repo), masuk memakai password di
   scripts/.env.core-passwords.local (tanpa menampilkannya):
   - akun divisi itu: GET /api/me menunjukkan division <SLUG> berstatus ok; GET /api/workspace berisi baris <SLUG>_*;
   - simpan satu baris uji lewat POST /api/changes, baca ulang, lalu hapus baris uji itu;
   - akun divisi lain tidak melihat baris <SLUG>_* (kecuali presiden/VP/board/admin);
   - akun Eksekutif (president) melihat; GET /api/audit: 403 untuk president, 200 untuk admin.
8. Kalau ada yang tidak sesuai harapan, jangan menyetel aturan akses supaya "lolos": cari penyebabnya dan laporkan.
9. Laporkan hasil apa adanya (yang lolos, yang gagal), lalu beri saran pesan commit. Jangan commit sendiri.

Aturan: jangan menghapus baris di proyek mana pun, jangan menulis ke proyek lain selain <SLUG> dan hub, dan
ingatkan aku untuk mengganti secret key yang kutempel di chat setelah selesai.
```

## Catatan

- Akun login aplikasi semua ada di hub (`people`), bukan di proyek divisi. Proyek divisi hanya menyimpan data divisinya.
- Akun divisi dan password awalnya dibuat oleh `scripts/database/seed-core-accounts.mjs` dan `scripts/database/set-core-passwords.mjs`.
- Divisi baru tidak muncul sampai `divisions.is_active` bernilai true di hub (langkah 5).
- Setelah keenam divisi selesai: pilih tempat hosting server ([SERVER.md](SERVER.md)), ganti `VITE_DATA_MODE=bff`, dan ganti semua secret key yang pernah ditempel di chat.
