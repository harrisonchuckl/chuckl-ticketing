// backend/src/services/stripe.ts
import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

// Use the current Stripe API version expected by @types/stripe
export const stripe = new Stripe(secret, {
  apiVersion: '2024-06-20',
});

export default stripe;
