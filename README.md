# iSEJARAH v74

Versi multi-fail berasaskan v65. Semua enjin, Supabase, autentikasi, formula, carta, jadual, borang, import/export dan aliran kerja dikekalkan. v70 memuktamadkan UI premium iSEJARAH menggunakan Deep Navy, Dark Navy, Electric Blue, Cyan, Teal, Premium Gold dan White yang ditetapkan.

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
14. Semua jadual modul menggunakan contained table shell; jadual ringkas muat dalam kad, manakala jadual lebar menggunakan scrollbar mendatar supaya teks tidak dihimpit atau terpotong.
15. Header jadual dipusatkan tanpa perkataan terputus; matriks pengisian PBD dikecualikan dan menggunakan scrollbar mendatar supaya semua SP kekal jelas.
16. Tarikh Ujian boleh ditetapkan berasingan untuk Diagnostik, UPSA dan UASA bagi setiap kelas. Profil murid, trend, dashboard, Headcount, analisis, intervensi dan laporan menentukan markah terkini mengikut tarikh ujian ini—bukan masa markah ditaip atau dikemas kini.
17. Panel Guru mempunyai Program Intervensi yang diselaraskan dengan data Admin dan terhad kepada murid daripada kelas tugasan guru. Modul Cetak/Jana Laporan serta Cetak Laporan Headcount hanya tersedia dalam panel Admin.
18. Kontrak warna light/dark diperketat: teks neutral, kad insight dan butang tindakan menggunakan kontras khusus mengikut mode, manakala helaian pratonton laporan kekal putih supaya PDF/cetakan tidak berubah.
19. Butang tindakan berlabel putih dikecualikan daripada aturan hiasan kotak tajuk; latar solid/gradient dan labelnya kini kekal jelas dalam light serta dark mode di semua modul.
20. PWA boleh dipasang sebagai ikon iSEJARAH pada telefon, tablet/iPad dan komputer, dibuka dalam paparan standalone serta mempunyai cache luar talian terhad untuk fail aplikasi.
21. Senarai `Headcount Sejarah → Prestasi Murid` menggunakan paparan jadual khusus pada tablet/desktop dan kad khusus pada telefon, tanpa konflik kelas `hidden` responsif.
22. Jadual Prestasi Murid mempunyai lajur BIL, nama murid sebaris, lebar lajur konsisten dan scrollbar mendatar; penapis status berada terus di sebelah carian murid.
23. Lapisan responsif v67 meliputi telefon, tablet/iPad dan desktop: semua jadual dikesan termasuk kandungan dinamik, tajuk/cell tidak dipecah kepada huruf, penapis serta butang menyusun semula mengikut ruang peranti.
24. Identiti visual v68: `assets/isejarah-login-hero.png` untuk panel login, `assets/isejarah-wordmark.png` untuk kepala sidebar dan `assets/isejarah-pwa-icon.png` untuk favicon/PWA.
25. Tema aplikasi v69: mode cerah menggunakan palet ice-blue dengan tulisan navy; mode gelap menggunakan permukaan deep-navy dengan tulisan cerah serta aksen cyan–biru. Cetakan dan PDF kekal neutral untuk kebolehbacaan.
26. Spesifikasi visual v70: Data Diperkasa menggunakan Blue/Cyan, Pentaksiran Dipermudah menggunakan Premium Gold secara terhad, dan Kecemerlangan Dipacu menggunakan Cyan/Teal. Carta analitik diselaraskan kepada palet yang sama tanpa mengubah data atau pengiraan.
27. Responsif v71: kontras Headcount diperkukuh, header aplikasi kekal fixed, jadual mengekalkan lebar lajur yang boleh dibaca dengan scroll mendatar, nama tidak dipotong, serta borang Markah/PBD menyusun semula pada tablet dan telefon.
28. Laporan A4 v72: semua jadual laporan mempunyai nisbah lajur khusus dan tidak lagi menerima lebar minimum/scrollbar jadual aplikasi. Helaian pratonton yang sama dirakam terus untuk PDF dan cetakan supaya kandungan, susun atur dan sempadan lajur kekal seragam.
29. Responsif v73: header tetap menghormati safe area iPhone/iPad; Data Murid, Kelengkapan dan Pengisian Markah bertukar kepada kad berlabel pada telefon; tablet/desktop mengekalkan jadual boleh leret; matriks PBD telefon tidak lagi membekukan BIL/Nama sehingga menutup ruangan SP.
30. Responsif v74: kotak Tarikh Ujian dikekang sepenuhnya dalam kad Pengisian Markah pada telefon, dan jadual lebar menggunakan leretan sentuh asli kiri/kanan tanpa dipaksa mengecil oleh gaya modul lama.
24. Pengisian Markah menggunakan jadual 920px yang boleh dileret dengan lajur BIL/Nama kekal; matriks PBD menggunakan ruang minimum 1420px supaya SP, TP dan purata kekal terbaca.
25. Header aplikasi kini benar-benar tetap pada bahagian atas di semua peranti. Ruang kandungan dan safe area iPhone/iPad diselaraskan supaya header tidak menutup paparan.

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
- Pastikan `manifest.webmanifest`, `sw.js`, `pwa.js`, `offline.html`, `assets/isejarah-pwa-icon.png`, `assets/isejarah-login-hero.png` dan `assets/isejarah-wordmark.png` turut dimuat naik; fail ini diperlukan untuk rupa dan pemasangan PWA yang lengkap.
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
