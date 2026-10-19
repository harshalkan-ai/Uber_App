import { Request, Response, NextFunction } from 'express';
import { stripe } from '../config/stripe';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../middlewares/error.middleware';
import { io } from '../server';

/**
 * 1. POST /api/v1/payments/create-intent
 * Generates Stripe PaymentIntent and returns clientSecret for checkout sheet.
 */
export const createPaymentIntent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.userId;
        const { rideId } = req.body;

        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        if (!rideId) {
            return next(new AppError('rideId is required to initialize payment', 400));
        }

        // 1. Fetch ride details
        const { data: ride, error } = await supabase
            .from('rides')
            .select('*')
            .eq('id', rideId)
            .single();

        if (error || !ride) {
            return next(new AppError('Ride not found', 404));
        }

        if (ride.rider_id !== userId) {
            return next(new AppError('Unauthorized: You can only pay for your own rides', 403));
        }

        if (ride.is_paid) {
            return next(new AppError('This ride has already been paid for', 400));
        }

        // 2. Stripe expects smallest currency unit (e.g. INR in paise: ₹140 = 14000)
        const amountInPaise = Math.round(ride.fare_amount * 100);

        // 3. Create Stripe PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInPaise,
            currency: 'inr',
            metadata: {
                rideId: ride.id,
                riderId: userId,
                driverId: ride.driver_id || '',
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // 4. Save PaymentIntent ID in database
        await supabase
            .from('rides')
            .update({ stripe_payment_intent_id: paymentIntent.id })
            .eq('id', rideId);

        res.status(200).json({
            success: true,
            data: {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                amount: ride.fare_amount,
                currency: 'INR',
            },
        });
    } catch (err) {
        next(err);
    }
};

/**
 * 2. POST /api/v1/payments/webhook
 * Handles asynchronous Stripe events.
 */
export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: any;

    try {
        if (webhookSecret && sig) {
            event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } else {
            // Fallback for development if webhook secret is not yet verified
            event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        }
    } catch (err: any) {
        console.error(`[Stripe Webhook Error]: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle successful charge
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const rideId = paymentIntent.metadata?.rideId;

        if (rideId) {
            console.log(`[Stripe] Payment confirmed for Ride: ${rideId}`);

            // Update database
            await supabase
                .from('rides')
                .update({
                    is_paid: true,
                    status: 'completed',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', rideId);

            // Notify both parties in the active ride room via WebSockets
            io.to(`ride:${rideId}`).emit('payment:success', {
                rideId,
                isPaid: true,
            });
        }
    }

    res.status(200).json({ received: true });
};