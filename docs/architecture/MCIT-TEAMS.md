# MCIT: ruang Director dan tiga sub-tim

Status (29 Oktober 2026): **sebagian sudah dibangun.** Sudah ada: atribut `team`, aturan akses di server dan SQL (keputusan M37), content tracker tampil dengan filter sub-tim, tiga halaman sub-tim (Creative, Communications, IT), metrik per publikasi, skrip `scripts/database/add-mcit-codirector.mjs`. Belum: akun tiga co-director (menunggu email dan pembagian sub-tim), papan tautan Member tanpa login, kontrol di aplikasi untuk mengatur `team` seseorang. Dua keputusan sudah diambil pemilik: (1) sub-tim hidup **di dalam MCIT** (satu divisi, satu proyek Supabase, atribut sub-tim pada orang); (2) co-director **melihat seluruh MCIT dan mengubah hanya milik sub-timnya**, Director mengubah semuanya.

## Siapa, dan akunnya

| Ruang | Pemegang | Role di aplikasi | Sub-tim |
|---|---|---|---|
| Director MCIT | pemilik divisi (`dwdgmarcomit@gmail.com`, sudah ada) | `director` | tidak ada |
| Creative | Co-director Creative | `codirector` | `creative` |
| Communications | Co-director Communications | `codirector` | `comms` |
| IT | Co-director IT | `codirector` | `it` |
| Member | belum punya akun | (tidak ada) | hanya menerima tautan |

Member belum diberi akun karena tugasnya eksekusi. Mereka menerima **tautan** dari Director atau co-director (lihat "Papan tautan" di bawah). Kalau nanti mereka diberi akun, role `member` dengan atribut sub-tim yang sama sudah cukup.

## Yang wajib ada di semua ruang (turunan MCIT)

Empat bagian ini sama untuk Director dan ketiga co-director. Hampir semuanya sudah dibangun; tugasnya mengaktifkan dan menyaring per sub-tim.

| # | Bagian | Sekarang | Yang perlu dikerjakan |
|---|---|---|---|
| 1 | **Content tracker** | Sudah ada (`content`, `ContentPage`, tahap, versi, review, publikasi per kanal) tetapi disembunyikan di rilis 1 (daftar `LATER`) | Tampilkan untuk MCIT. Tambah filter "milik sub-tim saya". |
| 2 | **Pekerjaan umum**: kalender, to-do, kanban | Sudah ada (My Work: List, Board, Timeline; Schedule) | Tidak ada. |
| 3 | **Updates** | Sudah ada | Tidak ada. |
| 4 | **Projects** | Sudah ada | Tidak ada. Proyek diberi tanda sub-tim lewat `lead`/`pm`. |

## Bagian khusus tiap sub-tim

### Creative: eksekusi desain (feed Instagram, video, dsb.)
- **Antrean produksi**: konten yang `executor`-nya orang Creative, urut tenggat dan tahap (mengerjakan, menunggu review, revisi).
- **Pustaka aset**: tautan Drive per konten dan per kampanye (field `assets` sudah ada). Dikelompokkan menurut format: feed, story, reels, video.
- **Spesifikasi format** per kanal (ukuran, durasi, caption) sebagai catatan tetap yang bisa dirujuk di brief.
- **Review dan revisi**: versi konten dan riwayat koreksi (sudah ada di model).
- Baru: tampilan "saya menunggu brief dari siapa" yang menaut ke brief Communications.

### Communications: perencanaan, akun media sosial, performa, pemantauan Creative
- **Kalender editorial** per kanal (Instagram, LinkedIn, website): konten yang direncanakan, dijadwalkan, dan terbit.
- **Brief ke Creative**: halaman brief yang sudah ada (`BriefPage`, kirim, terima, kembalikan).
- **Daftar akun media sosial**: custodian dan akses (`mcit_accounts` dan hak `custody` sudah ada).
- **Pemantau eksekusi**: daftar konten yang tenggatnya lewat atau belum selesai oleh Creative. Ini turunan dari content tracker, tanpa data baru.
- **Performa media sosial**: **belum ada**. Perlu diputuskan: catatan manual per publikasi (jangkauan, interaksi) atau impor. Rancangan awal: kolom metrik di catatan publikasi (`Publication`) yang diisi manual, plus ringkasan per kanal dan per bulan.

### IT: produk IT (web, Drive, dan perancangan proyek IT)
- **Permintaan IT**: halaman yang sudah ada (`it-requests`, `ItPage`: akses, bug, perubahan, tahap, tenggat).
- **Proyek produk IT**: papan proyek khusus (web, struktur Drive, dsb.) memakai Projects yang ada, dengan tahap perancangan.
- **Registri aset digital**: tautan ke repo, hosting, struktur Drive, dan siapa yang memegang aksesnya.
- **Permintaan akses**: dari Drive aset brand dan sejenisnya (jenis `access` sudah ada).

## Papan tautan untuk Member (tanpa akun)
Halaman satu per sub-tim berisi tautan yang dikurasi (Drive, brief, template, jadwal). Co-director menyusunnya, lalu membagikan lewat satu tautan. Memakai tabel `resources` yang sudah ada. Yang belum diputuskan: apakah tautan itu bisa dibuka tanpa login (perlu halaman publik hanya-baca dan token) atau cukup dikirim sebagai daftar tautan Drive biasa. Rancangan awal: **daftar tautan Drive biasa**, karena halaman publik membuka permukaan keamanan baru.

## Perubahan data dan akses

1. `people.doc.team`: `'creative' | 'comms' | 'it' | null`. Field di dalam `doc` (json), jadi **tanpa migrasi tabel**. Pembuatan akun co-director lewat `seed-core-accounts.mjs`.
2. Konten, brief, permintaan IT, dan akun diberi `team` pemilik (turun dari `executor` atau pembuatnya, bisa diisi tangan).
3. Aturan akses MCIT diperluas di **dua tempat yang harus sama**: aturan di server (`server/src/lib/policy/mcit.ts`) dan SQL (`database/schema/schema-spec.mjs`, lalu `npm run db:build-sql`). Aturannya:
   - baca: semua orang MCIT dan tingkat atas, seperti sekarang;
   - ubah: Director dan Admin semuanya; co-director hanya baris dengan `team` sama dengan miliknya; member sesuai aturan sekarang.
   Parity test (`server/tests/parity/mcit.parity.test.ts`) memeriksa keduanya.
4. Navigasi: bagian "Ruang saya" di sidebar, isinya halaman sub-tim milik orang itu. Director melihat ketiganya.

## Urutan pengerjaan
1. Aktifkan content tracker untuk MCIT, tambah `team` dan filter. (Kecil.)
2. Buat tiga akun co-director dan atribut `team`. Aturan akses dan parity test. (Menengah, menyentuh aturan akses.)
3. Halaman Creative.
4. Halaman Communications, termasuk keputusan metrik performa.
5. Halaman IT.
6. Papan tautan per sub-tim.

## Yang dibutuhkan dari pemilik
- Email dan nama tiga co-director (Creative, Communications, IT).
- Pembagian sub-tim untuk Hanafi, Amnun Bintang, dan Manggala Yoga.
- Papan tautan Member: diputuskan halaman publik hanya-baca tanpa login. Belum dibangun, lihat catatan di bawah.

## Keputusan yang sudah diambil
- Metrik performa: diisi manual per publikasi (jangkauan dan interaksi), di halaman Communications.
- Papan tautan Member: halaman publik hanya-baca tanpa login. Perlu tabel baru, tautan berisi token acak yang disimpan sebagai hash, rate limit, dan cara mencabut tautan. Ini menambah permukaan publik dan perubahan database di hub, jadi dikerjakan sebagai langkah terpisah.
