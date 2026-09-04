import { verifyToken } from '../utils.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, error: { message: 'Authentification requise' } });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: { message: 'Session expirée ou invalide' } });
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    req.user = verifyToken(token);
  } catch {
    // ignore invalid tokens for optional auth
  }
  return next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: { message: 'Authentification requise' } });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: { message: 'Accès refusé' } });
    }
    return next();
  };
}
