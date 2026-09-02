# Penyegerakan Google Sheets iSEJARAH

Supabase ialah data induk. Google Sheet hanya menerima paparan sehala bagi `MURID`, `MARKAH_UJIAN` dan `PBD`; perubahan pada Sheet tidak dihantar kembali ke Supabase.

## Aktifkan sekali sahaja

1. Buka Google Sheet **iSEJARAH Data Sync 2026**.
2. Pilih **Extensions → Apps Script**.
3. Gantikan kandungan `Code.gs` dengan fail `google-sheets/Code.gs` ini.
4. Buka **Project Settings**, tandakan **Show appsscript.json manifest file**, kemudian gantikan manifest dengan `google-sheets/appsscript.json`.
5. Tekan **Save**, kembali ke Google Sheet dan muat semula halaman.
6. Pilih menu **iSEJARAH Sync → Aktifkan sync automatik (5 minit)**.
7. Luluskan kebenaran Google yang dipaparkan. Skrip hanya boleh menulis pada Google Sheet ini dan memanggil endpoint iSEJARAH.

Selepas itu, guru terus mengisi data dalam aplikasi iSEJARAH. Sheet dikemas kini secara automatik dan tidak perlu diisi semula.
