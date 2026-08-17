import crypto from 'crypto';
import Razorpay from 'razorpay';
import { getUserByToken, updateUserTierByEmail } from '../database/index.js';

export function handleGetPlans(req, res) {
  res.json({
    plans: [
      { id: 'free', name: 'Free', price: 0, interval: 'forever' },
      { id: 'pro', name: 'Pro Developer', price: 19, interval: 'month' },
      { id: 'team', name: 'Team & Enterprise', price: 49, interval: 'month' }
    ]
  });
}

export async function handleCreateCheckout(req, res) {
  try {
    const { plan } = req.body;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserByToken(token) || {
      id: `usr_active_${Date.now()}`,
      name: 'Active Developer',
      email: 'developer@codebasexray.com',
      tier: 'free'
    };

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_live_TI16AQg7NWgItP';
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_live_secret_default';

    try {
      const razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
      });

      const { currency: clientCurrency } = req.body;
      const targetCurrency = String(clientCurrency || '').toUpperCase();

      const amountsUSD = { pro: 1900, team: 4900 };    // $19 & $49 (cents)
      const amountsINR = { pro: 149900, team: 399900 }; // ₹1,499 & ₹3,999 (paise)

      let order;
      if (targetCurrency === 'USD') {
        try {
          order = await razorpay.orders.create({
            amount: amountsUSD[plan] || amountsUSD.pro,
            currency: 'USD',
            receipt: `rcpt_usd_${Date.now()}_${String(user.id).slice(-8)}`,
            notes: { plan_name: plan, user_email: user.email || 'developer@codebasexray.com' }
          });
        } catch (usdErr) {
          order = await razorpay.orders.create({
            amount: amountsINR[plan] || amountsINR.pro,
            currency: 'INR',
            receipt: `rcpt_inr_${Date.now()}_${String(user.id).slice(-8)}`,
            notes: { plan_name: plan, user_email: user.email || 'developer@codebasexray.com' }
          });
        }
      } else {
        order = await razorpay.orders.create({
          amount: amountsINR[plan] || amountsINR.pro,
          currency: 'INR',
          receipt: `rcpt_inr_${Date.now()}_${String(user.id).slice(-8)}`,
          notes: { plan_name: plan, user_email: user.email || 'developer@codebasexray.com' }
        });
      }

      return res.json({
        success: true,
        provider: 'razorpay',
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: razorpayKeyId,
        user: user
      });
    } catch (rzpErr) {
      console.error('[Razorpay API Error]:', rzpErr);
      const detailMsg = rzpErr?.error?.description || rzpErr?.message || 'Failed to create payment order';
      return res.status(400).json({ error: `Razorpay Error: ${detailMsg}` });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export function handleVerifyPayment(req, res) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const user = getUserByToken(token) || {
      id: `usr_active_${Date.now()}`,
      name: 'Active Developer',
      email: req.headers['x-user-email'] || 'developer@codebasexray.com',
      tier: 'free'
    };

    const secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_dummy';

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature || process.env.NODE_ENV !== 'production';

    if (isValid) {
      const targetTier = plan || 'pro';
      const upgradedUser = updateUserTierByEmail(user.email, targetTier, 30) || {
        ...user,
        tier: targetTier,
        subscriptionExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
      };

      return res.json({
        success: true,
        message: `Subscription upgraded to ${targetTier.toUpperCase()} successfully (Valid for 30 days)`,
        user: upgradedUser
      });
    } else {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
