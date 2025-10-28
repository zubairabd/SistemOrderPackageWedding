# 💒 WeddingOrg Pro
Aplikasi manajemen **Wedding Organizer (WO)** modern berbasis web yang dikembangkan menggunakan **Node.js (Express.js)** dan **PostgreSQL** sebagai backend, serta **HTML + TailwindCSS** di sisi frontend.  
Aplikasi ini memungkinkan klien untuk memesan paket pernikahan, melakukan konfirmasi pembayaran, dan admin untuk mengelola pesanan serta memantau progres setiap acara.

🌐 **Demo Website (Frontend):** [https://zubairabd.github.io/SistemOrderPackageWedding/](https://zubairabd.github.io/SistemOrderPackageWedding/)

---

## 🏗️ Fitur Utama

### 👰 Untuk Klien:
- 🔐 **Autentikasi (Login & Register)**
- 📦 Melihat dan memesan **paket pernikahan**
- 📅 Mengecek **tanggal yang tersedia**
- 💸 **Upload bukti pembayaran** dan konfirmasi pesanan
- 🧾 Melihat status pesanan dan progres persiapan

### 🧑‍💼 Untuk Admin:
- 🧾 **Melihat semua pesanan**
- ✅ **Menyetujui pembayaran**
- 🗓️ **Membuat task otomatis** untuk setiap pesanan
- 📊 **Ringkasan keuangan & laporan pendapatan**
- 🔧 Mengatur status progress per event

---

## 🧰 Teknologi yang Digunakan
weddingorg-pro/
├── index.html # Halaman utama (frontend klien)
├── admin.html # Dashboard admin
├── dashboard.html # Panel klien
├── server.js # Server backend Express.js
├── authMiddleware.js # Middleware autentikasi JWT
├── adminOnlyMiddleware.js # Middleware pembatasan akses admin
├── .env # Konfigurasi environment
├── uploads/ # Folder penyimpanan bukti bayar
└── README.md # Dokumentasi proyek

| Bagian | Teknologi |
|--------|------------|
| **Frontend** | HTML5, TailwindCSS, JavaScript |
| **Backend** | Node.js (Express.js) |
| **Database** | PostgreSQL |
| **Autentikasi** | JWT (JSON Web Token) |
| **Keamanan** | bcrypt.js (hash password) |
| **File Upload** | multer |
| **Lingkungan** | dotenv |
| **Middleware** | Custom Auth dan Role Validator |

---

## 📂 Struktur Proyek

