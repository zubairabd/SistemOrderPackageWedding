function adminOnly(req, res, next) {

    if (req.user && req.user.role === 'admin') {
        next(); 
    } else {
        res.status(403).json({ message: 'Akses ditolak. Hanya untuk Admin.' });
    }
}

module.exports = adminOnly;

