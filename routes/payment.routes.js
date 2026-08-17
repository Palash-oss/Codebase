import express from 'express';
import { handleGetPlans, handleCreateCheckout, handleVerifyPayment } from '../controllers/payment.controller.js';

const router = express.Router();

router.get('/plans', handleGetPlans);
router.post('/create-checkout', handleCreateCheckout);
router.post('/verify-payment', handleVerifyPayment);

export default router;
