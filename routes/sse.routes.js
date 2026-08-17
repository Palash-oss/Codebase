import express from 'express';
import { handleSseConnection } from '../controllers/sse.controller.js';

const router = express.Router();

router.get(['/scan-progress', '/events'], handleSseConnection);

export default router;
