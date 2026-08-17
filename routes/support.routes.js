import express from 'express';
import { handleCreateTicket, handleGetTickets } from '../controllers/support.controller.js';

const router = express.Router();

router.post('/tickets', handleCreateTicket);
router.get('/tickets', handleGetTickets);

export default router;
