import express from 'express';
import { handleRegister, handleLogin, handleMe } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', handleRegister);
router.post('/login', handleLogin);
router.get('/me', handleMe);

export default router;
