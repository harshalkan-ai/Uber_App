import { Router } from 'express';
import express from 'express';
import { createPaymentIntent, handleStripeWebhook } from '../controllers/payment.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Create Payment Intent (Client Secret)
router.post('/create-intent', requireAuth, createPaymentIntent);

// Stripe Webhook (Receives raw body for signature verification)
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;