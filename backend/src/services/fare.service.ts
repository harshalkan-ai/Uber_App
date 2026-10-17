import { RideTier } from '../types';

export interface FareEstimate {
    rideTier: RideTier;
    fareAmount: number;
    distanceKm: number;
    durationMinutes: number;
    currency: string;
    description: string;
}

// Pricing rates matrix
const TIER_PRICING: Record<
    RideTier,
    { baseFare: number; perKmRate: number; perMinuteRate: number; minimumFare: number; description: string }
> = {
    UberGo: {
        baseFare: 40.0,
        perKmRate: 12.0,
        perMinuteRate: 1.5,
        minimumFare: 60.0,
        description: 'Affordable, compact rides for everyday travel',
    },
    UberPremier: {
        baseFare: 60.0,
        perKmRate: 16.0,
        perMinuteRate: 2.0,
        minimumFare: 90.0,
        description: 'Comfortable sedans with top-rated drivers',
    },
    UberXL: {
        baseFare: 90.0,
        perKmRate: 22.0,
        perMinuteRate: 3.0,
        minimumFare: 130.0,
        description: 'Spacious SUVs with seating for up to 6 people',
    },
};

/**
 * Calculates fare estimates for all vehicle tiers given distance and duration.
 */
export const calculateAllFares = (
    distanceKm: number,
    durationMinutes: number
): FareEstimate[] => {
    const tiers: RideTier[] = ['UberGo', 'UberPremier', 'UberXL'];

    return tiers.map((tier) => {
        const config = TIER_PRICING[tier];

        // Formula: Base + (Distance * perKm) + (Duration * perMinute)
        const rawFare = config.baseFare + distanceKm * config.perKmRate + durationMinutes * config.perMinuteRate;

        // Ensure fare never drops below the tier minimum fare
        const finalFare = Math.max(config.minimumFare, Math.round(rawFare));

        return {
            rideTier: tier,
            fareAmount: finalFare,
            distanceKm,
            durationMinutes,
            currency: 'INR',
            description: config.description,
        };
    });
};

/**
 * Computes single fare for a specifically selected tier.
 */
export const calculateSingleFare = (
    tier: RideTier,
    distanceKm: number,
    durationMinutes: number
): number => {
    const config = TIER_PRICING[tier] || TIER_PRICING.UberGo;
    const rawFare = config.baseFare + distanceKm * config.perKmRate + durationMinutes * config.perMinuteRate;
    return Math.max(config.minimumFare, Math.round(rawFare));
};