import { calculateMappingDuration } from '../../utils/business-logic';

// Test suite for the calculateMappingDuration function
describe('calculateMappingDuration', () => {
  // Test case: Valid positive numeric inputs for square footage.
  test('should calculate duration correctly for valid positive square footage', () => {
    expect(calculateMappingDuration(1000)).toBe(1000 / 100 + 15); // 10 + 15 = 25
    expect(calculateMappingDuration(250)).toBe(2.5 + 15);     // 2.5 + 15 = 17.5
    expect(calculateMappingDuration(15000)).toBe(150 + 15); // 150 + 15 = 165
  });

  // Test case: Square footage is zero.
  test('should calculate duration correctly for zero square footage', () => {
    expect(calculateMappingDuration(0)).toBe(0 / 100 + 15); // 0 + 15 = 15
  });

  // Test case: Square footage is provided as a string that can be coerced to a number.
  test('should handle string numeric input', () => {
     expect(calculateMappingDuration("500")).toBe(500/100 + 15); // 5 + 15 = 20
  });

  // Test case: Square footage is a non-numeric string. Expect NaN.
  test('should return NaN for non-numeric string input', () => {
    // The original code `Number('abc') / 100 + 15` would result in NaN.
    // The function implementation also explicitly returns NaN for this.
    expect(calculateMappingDuration('abc')).toBeNaN();
  });

  // Test case: Square footage is negative (both number and string representations). Expect NaN.
  test('should return NaN for negative square footage input', () => {
    // Original code `Number(-100) / 100 + 15` would be `-1 + 15 = 14`.
    // The function implementation has been made to return NaN for negative inputs.
    expect(calculateMappingDuration(-100)).toBeNaN();
    expect(calculateMappingDuration("-200")).toBeNaN();
  });

  // Test case: Input is null. Expect NaN.
  test('should return NaN for null input', () => {
    expect(calculateMappingDuration(null)).toBeNaN();
  });

  // Test case: Input is undefined. Expect NaN.
  test('should return NaN for undefined input', () => {
    expect(calculateMappingDuration(undefined)).toBeNaN();
  });

  // Test case: Square footage is a large number.
  test('should handle large numbers correctly', () => {
     expect(calculateMappingDuration(1000000)).toBe(1000000 / 100 + 15); // 10000 + 15 = 10015
  });
});
