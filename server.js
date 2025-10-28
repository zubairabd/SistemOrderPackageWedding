// --- Impor Modul ---
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer'); 
const path = require('path');     
const fs = require('fs');         
require('dotenv').config();

// --- Impor Middleware ---
const authMiddleware = require('./authMiddleware');
const adminOnlyMiddleware = require('./adminOnlyMiddleware');

// --- Konfigurasi Aplikasi ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- Konfigurasi Koneksi Database (pg) ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect(err => {
    if (err) {
        console.error('Koneksi database gagal:', err.stack);
    } else {
        console.log('Terhubung ke database PostgreSQL...');
    }
});

// --- Konfigurasi Multer (File Upload) ---
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
    console.log("Folder 'uploads' telah dibuat.");
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, 'uploads/'); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg") {
            cb(null, true);
        } else {
            cb(null, false);
            return cb(new Error('Hanya format .png, .jpg, dan .jpeg yang diizinkan!'));
        }
    }
});


// --- Middleware Global ---
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- Rute API ---

app.get('/api', (req, res) => res.send('API Wedding Organizer berjalan!'));

// === Rute Autentikasi (Publik) ===
app.post('/api/auth/register', async (req, res) => {
    const { nama, email, password, role = 'client' } = req.body; 
    if (!nama || !email || !password) return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
    try {
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) return res.status(400).json({ message: 'Email sudah terdaftar.' });
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const newUser = await pool.query( 'INSERT INTO users (nama_lengkap, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING user_id, nama_lengkap, email, role', [nama, email, passwordHash, role] );
        res.status(201).json(newUser.rows[0]);
    } catch (error) { console.error('Error register:', error.message); res.status(500).json({ message: 'Terjadi kesalahan pada server.' }); }
});
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) return res.status(400).json({ message: 'Email atau password salah.' });
        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ message: 'Email atau password salah.' });
        const payload = { user: { id: user.user_id, nama: user.nama_lengkap, role: user.role } };
        const token = jwt.sign( payload, process.env.JWT_SECRET, { expiresIn: '365d' } );
        res.json({ token, user: payload.user });
    } catch (error) { console.error('Error login:', error.message); res.status(500).json({ message: 'Terjadi kesalahan pada server.' }); }
});


// === Rute Paket & Tanggal (Publik) ===
app.get('/api/packages', async (req, res) => {
    try { const packages = await pool.query('SELECT * FROM packages WHERE is_active = TRUE'); res.json(packages.rows); } 
    catch (error) { console.error('Error get packages:', error.message); res.status(500).json({ message: 'Gagal memuat paket.' }); }
});
app.get('/api/booked-dates', async (req, res) => {
    try {
        const bookedDatesResult = await pool.query( "SELECT tanggal_pernikahan FROM orders WHERE status_pesanan != 'Batal' AND status_pesanan != 'Selesai'" );
        const dates = bookedDatesResult.rows.map(row => new Date(row.tanggal_pernikahan).toISOString().split('T')[0] );
        res.json(dates); 
    } catch (error) { console.error('Error get booked dates:', error.message); res.status(500).json({ message: 'Gagal memuat tanggal.' }); }
});


// === Rute Klien (Perlu Login) ===
app.get('/api/client/my-order', authMiddleware, async (req, res) => {
    try { 
        const userId = req.user.id; 
        // JOIN juga dengan tasks untuk mengirimkan progress ke klien
        const orderResult = await pool.query( 
            `SELECT o.*, p.nama_paket 
             FROM orders o 
             JOIN packages p ON o.package_id = p.package_id 
             WHERE o.user_id = $1 
             ORDER BY o.created_at DESC 
             LIMIT 1`, 
             [userId] 
        ); 
        
        let orderData = orderResult.rows.length > 0 ? orderResult.rows[0] : null;
        
        // Jika ada order, ambil juga tasks-nya
        if (orderData) {
            const tasksResult = await pool.query(
                'SELECT task_id, task_name, is_done FROM preparation_tasks WHERE order_id = $1 ORDER BY task_id', 
                [orderData.order_id]
            );
            // Tambahkan array tasks ke data order, pastikan tasks selalu array
            orderData.tasks = tasksResult.rows || []; 
        }
        
        res.json({ order: orderData }); 
    } 
    catch (error) { console.error('Error get my-order:', error.message); res.status(500).json({ message: 'Gagal memuat data pesanan.' }); }
});
app.post('/api/client/orders', authMiddleware, async (req, res) => {
    const { package_id, tanggal_pernikahan, total_harga } = req.body; const userId = req.user.id;
    if (!package_id || !tanggal_pernikahan || !total_harga) return res.status(400).json({ message: 'Data tidak lengkap.' });
    try {
        const existingOrder = await pool.query( "SELECT * FROM orders WHERE user_id = $1 AND status_pesanan NOT IN ('Selesai', 'Batal')", [userId] );
        if (existingOrder.rows.length > 0) return res.status(400).json({ message: 'Anda sudah memiliki pesanan aktif.' });
        const dateCheck = await pool.query( "SELECT * FROM orders WHERE tanggal_pernikahan = $1 AND status_pesanan NOT IN ('Batal', 'Selesai')", [tanggal_pernikahan] );
        if (dateCheck.rows.length > 0) return res.status(400).json({ message: 'Maaf, tanggal tersebut sudah dipesan.' });
        const newOrder = await pool.query( `INSERT INTO orders (user_id, package_id, tanggal_pernikahan, total_harga) VALUES ($1, $2, $3, $4) RETURNING *`, [userId, package_id, tanggal_pernikahan, total_harga] );
        const orderResult = await pool.query( `SELECT o.*, p.nama_paket FROM orders o JOIN packages p ON o.package_id = p.package_id WHERE o.order_id = $1`, [newOrder.rows[0].order_id] );
        res.status(201).json(orderResult.rows[0]);
    } catch (error) { console.error('Error create order:', error.message); res.status(500).json({ message: 'Gagal membuat pesanan.' }); }
});
app.post('/api/client/orders/confirm', authMiddleware, upload.single('buktiBayar'), async (req, res) => {
    const { orderId, jumlahBayar } = req.body; const userId = req.user.id;
    if (!req.file) return res.status(400).json({ message: 'Bukti pembayaran wajib diunggah.' });
    const buktiBayarUrl = req.file.path.replace(/\\/g, "/"); 
    if (!orderId || !jumlahBayar) return res.status(400).json({ message: 'Data tidak lengkap.' });
    try {
        const updatedOrderResult = await pool.query( `UPDATE orders SET status_pembayaran = 'Menunggu Konfirmasi', bukti_bayar_url = $1, jumlah_bayar_klien = $2 WHERE order_id = $3 AND user_id = $4 RETURNING *`, [buktiBayarUrl, jumlahBayar, orderId, userId] );
        if (updatedOrderResult.rows.length === 0) return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
        const orderResult = await pool.query( `SELECT o.*, p.nama_paket FROM orders o JOIN packages p ON o.package_id = p.package_id WHERE o.order_id = $1`, [updatedOrderResult.rows[0].order_id] );
        res.json({ message: 'Konfirmasi berhasil diunggah.', order: orderResult.rows[0] });
    } catch (error) { console.error('Error confirm payment:', error.message); res.status(500).json({ message: 'Gagal mengunggah konfirmasi.' }); }
});


// === Rute Admin (Perlu Login & Role Admin) ===
const adminRoutes = [authMiddleware, adminOnlyMiddleware];

app.get('/api/admin/orders', adminRoutes, async (req, res) => {
    try {
        const allOrders = await pool.query( `SELECT o.*, u.nama_lengkap AS nama_klien, u.email AS email_klien, p.nama_paket FROM orders o JOIN users u ON o.user_id = u.user_id JOIN packages p ON o.package_id = p.package_id ORDER BY o.created_at DESC` );
        res.json(allOrders.rows);
    } catch (error) { console.error('Error get all orders:', error.message); res.status(500).json({ message: 'Gagal memuat semua pesanan.' }); }
});

app.put('/api/admin/orders/approve/:orderId', adminRoutes, async (req, res) => {
    const { orderId } = req.params;
    try {
        // Update status pesanan
        const approvedOrder = await pool.query( `UPDATE orders SET status_pembayaran = 'Lunas', status_pesanan = 'Dikonfirmasi' WHERE order_id = $1 RETURNING *`, [orderId] );
        if (approvedOrder.rows.length === 0) return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
        
        const currentOrder = approvedOrder.rows[0];
        
        // Cek dan buat task default jika belum ada
        const existingTasks = await pool.query('SELECT * FROM preparation_tasks WHERE order_id = $1', [orderId]);
        if (existingTasks.rows.length === 0) {
            const defaultTasks = [ 'Meeting Awal & Konsep', 'Booking & DP Venue', 'Pemilihan & DP Katering', 'Pemilihan & DP Dekorasi', 'Fitting & DP Busana Pengantin', 'Pemilihan & DP Fotografer/Videografer', 'Pemilihan & DP MUA', 'Pemesanan Undangan & Souvenir', 'Koordinasi Hari-H' ];
            // Gunakan Promise.all untuk efisiensi
            await Promise.all(defaultTasks.map(taskName => 
                pool.query( 'INSERT INTO preparation_tasks (order_id, task_name) VALUES ($1, $2)', [orderId, taskName] )
            )); 
            console.log(`Task default dibuat untuk order ${orderId}`);
        }
        res.json({ message: 'Pembayaran disetujui.', order: currentOrder });
    } catch (error) { console.error('Error approve payment:', error.message); res.status(500).json({ message: 'Gagal menyetujui atau membuat task.' }); }
});

app.get('/api/admin/financial-summary', adminRoutes, async (req, res) => {
    try {
        const result = await pool.query( "SELECT SUM(total_harga) AS total_revenue FROM orders WHERE status_pembayaran = 'Lunas'" );
        const countResult = await pool.query( "SELECT COUNT(*) AS total_paid_orders FROM orders WHERE status_pembayaran = 'Lunas'" );
        const totalRevenue = result.rows[0].total_revenue || 0;
        const totalPaidOrders = countResult.rows[0].total_paid_orders || 0;
        res.json({ totalRevenue: parseFloat(totalRevenue), totalPaidOrders: parseInt(totalPaidOrders, 10) });
    } catch (error) { console.error('Error get financial summary:', error.message); res.status(500).json({ message: 'Gagal menghitung ringkasan keuangan.' }); }
});

// --- Rute Admin untuk Tasks ---
app.get('/api/admin/orders/:orderId/tasks', adminRoutes, async (req, res) => {
    const { orderId } = req.params;
    try {
        const tasks = await pool.query('SELECT * FROM preparation_tasks WHERE order_id = $1 ORDER BY task_id', [orderId]);
        res.json(tasks.rows);
    } catch (error) { console.error(`Error get tasks for order ${orderId}:`, error.message); res.status(500).json({ message: 'Gagal memuat daftar tugas.' }); }
});

app.put('/api/admin/tasks/:taskId', adminRoutes, async (req, res) => {
    const { taskId } = req.params;
    const { is_done } = req.body; 
    if (typeof is_done !== 'boolean') return res.status(400).json({ message: 'Status is_done (true/false) harus disertakan.' });
    try {
        const updatedTask = await pool.query( 'UPDATE preparation_tasks SET is_done = $1, updated_at = NOW() WHERE task_id = $2 RETURNING *', [is_done, taskId] );
        if (updatedTask.rows.length === 0) return res.status(404).json({ message: 'Tugas tidak ditemukan.' });
        res.json(updatedTask.rows[0]); 
    } catch (error) { console.error(`Error update task ${taskId}:`, error.message); res.status(500).json({ message: 'Gagal memperbarui status tugas.' }); }
});

// --- Menjalankan Server ---
app.listen(PORT, () => {
    console.log(`Server backend berjalan di http://localhost:${PORT}`);
});

