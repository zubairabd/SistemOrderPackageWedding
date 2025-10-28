// File: backend/adminOnlyMiddleware.js

function adminOnly(req, res, next) {
    // Middleware ini harus dijalankan SETELAH middleware 'auth'
    if (req.user && req.user.role === 'admin') {
        next(); // Lanjutkan jika user adalah admin
    } else {
        res.status(403).json({ message: 'Akses ditolak. Hanya untuk Admin.' });
    }
}

module.exports = adminOnly;
