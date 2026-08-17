import { getUserByToken, checkIpScanLimit } from '../database/index.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const userEmail = req.headers['x-user-email'] || null;

  if (token) {
    const user = getUserByToken(token, userEmail);
    if (user) {
      req.user = user;
    }
  }
  next();
}

export function enforceScanQuota(req, res, next) {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const userEmail = req.headers['x-user-email'] || '';

  const ipCheck = checkIpScanLimit(clientIp, token, userEmail);
  if (!ipCheck.allowed) {
    return res.status(429).json(ipCheck);
  }

  req.clientIp = clientIp;
  req.userEmail = userEmail;
  next();
}
