import { describe, it, expect } from 'vitest';
import { generateToken } from './TeamMembers'; // Assuming test file is in the same directory

describe('TeamMembers Utilities', () => {
  describe('generateToken', () => {
    it('should generate a token of default length 24', () => {
      const token = generateToken();
      expect(token).toBeTypeOf('string');
      expect(token.length).toBe(24);
    });

    it('should generate a token of specified length', () => {
      const token = generateToken(32);
      expect(token.length).toBe(32);
    });

    it('should generate different tokens on subsequent calls', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it('should only contain alphanumeric characters', () => {
      const token = generateToken();
      expect(token).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('should handle length 0', () => {
      const token = generateToken(0);
      expect(token).toBe('');
    });

    it('should handle negative length by returning an empty string', () => {
      const tokenNegative = generateToken(-5);
      expect(tokenNegative).toBe('');
    });
  });
});
