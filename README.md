# iSEJARAH v66

Versi multi-fail berasaskan v65. Reka bentuk pastel/Islamic, responsive UI dan semua enjin sedia ada dikekalkan. Imej Base64 telah dipindahkan ke `assets/` untuk caching dan penyelenggaraan yang lebih mudah.

## Modul baharu

1. Dashboard Guru untuk kelas ditugaskan, kelengkapan, Near Miss dan tindakan cepat.
2. Laluan migrasi Supabase Auth + RLS kelas/peranan.
3. Pusat Kelengkapan Data.
4. Progress PBD Pertengahan→Akhir serta bilangan rekod diwarisi.
5. Murid Memerlukan Perhatian berasaskan markah, PBD dan trend.
6. Skema susulan intervensi: tarikh semakan, hasil, status dan overdue.
7. Rollover sesi 2027 melalui enrolmen baharu; data sejarah tidak ditimpa.
8. Backup JSON penuh dan Audit Trail.
9. Laporan Eksekutif Panitia yang boleh dicetak/PDF.
10. Laporan Prestasi Individu tiga bahagian: perbandingan markah dan sasaran, progression PBD, serta intervensi/pelan tindakan.
11. Pratonton, cetakan dan PDF laporan menggunakan helaian A4 yang sama; jadual GPMP kelas/tahun dipadatkan tanpa scroll mendatar.
12. PDF dan Cetak merakam terus helaian pratonton kepada halaman PNG A4, mengelakkan perbezaan akibat print CSS atau responsive reflow.
13. Alignment jadual diseragamkan secara semantik dan jadual GPMP diberi ruang dalaman dalam kad.
14. Semua jadual modul menggunakan contained table shell tanpa scrollbar mendatar, dengan warna teks/surface yang responsif kepada light dan dark mode.
15. Header jadual dipusatkan tanpa perkataan terputus; matriks pengisian PBD dikecualikan dan menggunakan scrollbar mendatar supaya semua SP kekal jelas.
16. Tarikh Ujian boleh ditetapkan berasingan untuk Diagnostik, UPSA dan UASA bagi setiap kelas. Profil murid, trend, dashboard, Headcount, analisis, intervensi dan laporan menentukan markah terkini mengikut tarikh ujian ini—bukan masa markah ditaip atau dikemas kini.
17. Panel Guru mempunyai Program Intervensi yang diselaraskan dengan data Admin dan terhad kepada murid daripada kelas tugasan guru. Modul Cetak/Jana Laporan serta Cetak Laporan Headcount hanya tersedia dalam panel Admin.
18. Kontrak warna light/dark diperketat: teks neutral, kad insight dan butang tindakan menggunakan kontras khusus mengikut mode, manakala helaian pratonton laporan kekal putih supaya PDF/cetakan tidak berubah.
19. Butang tindakan berlabel putih dikecualikan daripada aturan hiasan kotak tajuk; latar solid/gradient dan labelnya kini kekal jelas dalam light serta dark mode di semua modul.
20. PWA boleh dipasang sebagai ikon iSEJARAH pada telefon, tablet/iPad dan komputer, dibuka dalam paparan standalone serta mempunyai cache luar talian terhad untuk fail aplikasi.
21. Senarai `Headcount Sejarah → Prestasi Murid` menggunakan paparan jadual khusus pada tablet/desktop dan kad khusus pada telefon, tanpa konflik kelas `hidden` responsif.
22. Jadual Prestasi Murid mempunyai lajur BIL, nama murid sebaris, lebar lajur konsisten dan scrollbar mendatar; penapis status berada terus di sebelah carian murid.

## Pemasangan PWA

- Android/Chrome/Edge: gunakan butang `Pasang App` apabila ia muncul pada bar atas, atau pilih `Install app` daripada menu browser.
- iPhone/iPad: buka laman melalui Safari, tekan `Share`, kemudian pilih `Add to Home Screen`.
- Netlify menyediakan HTTPS secara automatik. Service worker hanya aktif melalui HTTPS atau `localhost`; ia tidak aktif apabila `index.html` dibuka terus menggunakan `file://`.
- Selepas fail PWA dikemas kini, `sw.js` tidak dicache oleh Netlify supaya versi baharu dikesan dengan segera.

### Had offline yang disengajakan

- Fail aplikasi, logo, latar dan pustaka paparan daripada CDN yang dibenarkan dicache selepas digunakan.
- Permintaan Supabase, login, markah, PBD, intervensi dan operasi simpan **tidak dicache** oleh service worker.
- Semasa offline, banner akan memaklumkan bahawa paparan adalah terhad dan pengisian data memerlukan internet.
- Apabila internet pulih, sambungan Supabase Realtime dimulakan semula. Tiada barisan tulis offline digunakan, bagi mengelakkan konflik atau pertindihan rekod murid.

## Tarikh ujian dan data lama

- Admin memilih sesi, kelas dan jenis ujian dalam `Pengisian Markah`, kemudian mengemas kini medan `Tarikh Ujian` pada kad ujian.
- Guru melihat tarikh yang sama dalam paparan baca sahaja dan tidak perlu mengisi atau mengubahnya.
- Rekod lama tidak diubah atau dipadam. Tarikh `1 Januari` pada template lama ditandakan untuk semakan kerana ia mungkin tarikh contoh.
- Template baharu tidak lagi diberikan tarikh contoh secara automatik; Admin perlu menetapkan tarikh ujian sebenar.
- Jika tarikh belum diisi, sistem menggunakan turutan tetap Diagnostik → UPSA → UASA sebagai fallback sahaja. Sebaik sahaja tarikh sah tersedia, tarikh ujian menjadi sumber utama susunan prestasi.

## Deploy Netlify / GitHub

- Muat naik keseluruhan folder ini ke repository GitHub.
- Netlify: pilih repository tersebut. Build command dikosongkan dan publish directory ialah `.`.
- Pastikan `manifest.webmanifest`, `sw.js`, `pwa.js`, `offline.html` dan `assets/pwa-icon.svg` turut dimuat naik; fail ini diperlukan untuk pemasangan PWA.
- Jangan tambah service-role key. `config.js` hanya mengandungi URL dan publishable key yang memang sesuai untuk browser apabila RLS aktif.
- Untuk local preview, gunakan mana-mana static web server; jangan buka melalui `file://` jika browser menyekat CDN/module.

## Migrasi pangkalan data (tanpa memadam data)

1. Buat backup projek Supabase terlebih dahulu.
2. Jalankan SQL mengikut urutan: `001_auth_rls.sql`, `002_feature_schema.sql`, `003_rollover_and_audit.sql`.
3. Cipta akaun guru/admin di Supabase Authentication menggunakan email dan kata laluan sementara yang selamat.
4. Pautkan setiap akaun secara manual, contoh:

```sql
update public.users
set auth_user_id = 'UUID-DARIPADA-AUTH-USERS'
where id = 'ID-PENGGUNA-ISEJARAH';
```

5. Uji seorang Admin dan seorang Guru di staging. Pastikan Guru hanya melihat kelas yang `classes.teacher_id` sepadan dengan `users.id`.
   Uji juga bahawa Guru boleh membaca/menulis intervensi kelas sendiri, tidak boleh membuka Cetak/Jana Laporan atau Cetak Laporan Headcount, dan tidak boleh mengubah rekod `assessments` termasuk Tarikh Ujian.
6. Tukar `authMode` dalam `config.js` daripada `legacy_anonymous` kepada `password`. Dalam mod ini medan User ID menerima email Supabase Auth.
7. Selepas semua akaun berjaya dipautkan dan diuji, nyahkomen arahan `revoke ... from anon` di hujung `001_auth_rls.sql` dan jalankan arahan itu secara berasingan.

Mod `legacy_anonymous` dikekalkan sebagai laluan peralihan supaya deployment semasa tidak terputus. Ia bukan sasaran akhir production.

## Rollover 2027

Rollover menggunakan `student_enrollments`. Ia menambah enrolmen baharu secara idempotent:

- Tahun 4 → Tahun 5 (`PENDING_ASSIGNMENT`)
- Tahun 5 → Tahun 6 (`PENDING_ASSIGNMENT`)
- Tahun 6 → `GRADUATED`
- guru/kelas baharu sengaja kosong sehingga Admin membuat penugasan
- markah, PBD dan kelas sesi lama tidak diubah atau dipadam

Sebelum rollover pertama, masukkan enrolmen sesi aktif ke `student_enrollments` daripada data murid semasa. Semak pemetaan nama kolum pada pangkalan data sebenar sebelum import kerana v65 mungkin menggunakan variasi skema lama.

## Nota keselamatan

- Publishable key bukan rahsia; keselamatan sebenar datang daripada Supabase Auth + RLS.
- Jangan masukkan service-role key dalam `config.js`, GitHub atau Netlify environment yang dihantar ke browser.
- Jalankan migrasi dan ujian akses pada projek staging dahulu.
- SQL ini additive/backward-safe; tiada `drop table`, `truncate` atau pemadaman data.
