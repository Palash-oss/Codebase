import { registerUser, loginUser, getUserByToken } from '../database/index.js';

export function handleRegister(req, res) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = registerUser(email, password, name);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}

export function handleLogin(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = loginUser(email, password);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
}

export function handleMe(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserByToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized or session expired' });
    }
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
