// File: backend/authMiddleware.js
const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // Ambil token dari header
    const token = req.header('x-auth-token');

    // Cek jika tidak ada token
    if (!token) {
        return res.status(401).json({ message: 'Akses ditolak. Tidak ada token.' });
    }

    // Verifikasi token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user; // Simpan payload user di request
        next(); // Lanjutkan ke rute
    } catch (err) {
        res.status(401).json({ message: 'Token tidak valid.' });
    }
};
