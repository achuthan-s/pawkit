/**
 * Species + weight + life-stage → estimated daily food consumption in grams.
 * Used as cold-start when no explicit foodPreferences.dailyAmountGrams is set.
 *
 * Sources: WSAVA Global Nutrition Guidelines, AAFCO, manufacturer feeding tables.
 */

export type LifeStage = "puppy" | "adult" | "senior";

interface BreedTier {
  maxKg: number;
  adultGramsPerKg: number;
  puppyGramsPerKg: number;
  seniorGramsPerKg: number;
}

const DOG_TIERS: BreedTier[] = [
  { maxKg:  5, adultGramsPerKg: 48, puppyGramsPerKg: 72, seniorGramsPerKg: 40 },
  { maxKg: 10, adultGramsPerKg: 42, puppyGramsPerKg: 65, seniorGramsPerKg: 35 },
  { maxKg: 25, adultGramsPerKg: 35, puppyGramsPerKg: 55, seniorGramsPerKg: 30 },
  { maxKg: 45, adultGramsPerKg: 28, puppyGramsPerKg: 45, seniorGramsPerKg: 24 },
  { maxKg: Infinity, adultGramsPerKg: 22, puppyGramsPerKg: 36, seniorGramsPerKg: 18 },
];

const CAT_BASE: Record<LifeStage, number> = {
  puppy:  75,
  adult:  55,
  senior: 45,
};

const OTHER_GRAMS_PER_KG: Record<string, number> = {
  rabbit: 50,
  bird:   20,
  other:  30,
};

/**
 * Estimate daily food consumption in grams.
 * @param species  pet species string from the Pet model
 * @param weightKg body weight in kg (0 defaults to a species-typical median)
 * @param stage    life stage (puppy / adult / senior)
 */
export function estimateDailyGrams(
  species: string,
  weightKg: number,
  stage: LifeStage = "adult"
): number {
  const w = weightKg > 0 ? weightKg : speciesMedianWeight(species);

  if (species === "dog") {
    const tier = DOG_TIERS.find((t) => w <= t.maxKg) ?? DOG_TIERS[DOG_TIERS.length - 1];
    const rate =
      stage === "puppy"  ? tier.puppyGramsPerKg  :
      stage === "senior" ? tier.seniorGramsPerKg : tier.adultGramsPerKg;
    return Math.round(w * rate);
  }

  if (species === "cat") {
    return CAT_BASE[stage];
  }

  const perKg = OTHER_GRAMS_PER_KG[species] ?? 30;
  return Math.round(w * perKg);
}

/** Typical body weight (kg) used when a pet has no weight recorded. */
function speciesMedianWeight(species: string): number {
  const medians: Record<string, number> = {
    dog:    12,
    cat:     4,
    rabbit:  2,
    bird:  0.15,
    other:   5,
  };
  return medians[species] ?? 5;
}

/**
 * Infer life stage from date-of-birth.
 * Thresholds are species-appropriate.
 */
export function inferLifeStage(species: string, dob: Date | undefined): LifeStage {
  if (!dob) return "adult";
  const ageYears = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (species === "dog") {
    if (ageYears < 1)  return "puppy";
    if (ageYears > 7)  return "senior";
    return "adult";
  }
  if (species === "cat") {
    if (ageYears < 1)  return "puppy";
    if (ageYears > 10) return "senior";
    return "adult";
  }
  return ageYears < 0.5 ? "puppy" : "adult";
}

/** Pack sizes (grams) parsed from product size labels. */
export function parsePackGrams(sizeLabel: string): number | null {
  const m = sizeLabel.match(/([\d.]+)\s*(kg|g)\b/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  return m[2].toLowerCase() === "kg" ? val * 1000 : val;
}
