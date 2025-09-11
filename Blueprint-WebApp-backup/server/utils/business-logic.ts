/**
 * Calculates the estimated mapping duration based on square footage.
 * @param {number | string | null | undefined} squareFootage The estimated square footage.
 * @returns {number} The calculated mapping duration in minutes. Returns NaN if input is invalid (non-numeric, negative).
 */
export function calculateMappingDuration(squareFootage: number | string | null | undefined): number {
  if (squareFootage === null || squareFootage === undefined) {
    // Or throw an error, depending on desired handling for truly missing input
    // For now, let's match the behavior if Number(null) or Number(undefined) was used, which is 0.
    // However, the problem implies this function is called *after* validation.
    // Let's assume valid, positive or zero, numeric input based on prior validation.
    // If validation allows non-numeric through, this needs to be more robust.
    // Given the tests required, let's handle non-numeric explicitly.
    return NaN; // Indicate invalid input if it's not a number after conversion
  }

  const numSquareFootage = Number(squareFootage);

  if (isNaN(numSquareFootage) || numSquareFootage < 0) {
    // Plan asks to test non-numeric and negative.
    // The original code did `Number(estimated_square_footage) / 100 + 15`.
    // If `estimated_square_footage` was non-numeric string, `Number()` would be NaN.
    // If it was negative, it would proceed.
    // Let's make this function robust for direct use.
    return NaN; // Or throw error: throw new Error("Square footage must be a non-negative number.");
  }

  return numSquareFootage / 100 + 15;
}
