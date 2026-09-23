/**
 * FinTrack Pro — Unit Tests: Multi-Currency Service & Formatting
 */

import { describe, it, expect } from 'vitest';
import {
  CURRENCIES,
  formatCurrency,
  formatCompact,
  toIndianNumberFormat,
  convert,
  detectCurrencyFromLocale,
} from '../../src/services/currency.js';

describe('Currency Service & Calculations (src/services/currency.js)', () => {
  describe('Supported Currencies Registry', () => {
    it('contains essential global and regional currencies', () => {
      const codes = CURRENCIES.map((c) => c.code);
      expect(codes).toContain('INR');
      expect(codes).toContain('USD');
      expect(codes).toContain('EUR');
      expect(codes).toContain('GBP');
      expect(codes).toContain('JPY');
      expect(codes).toContain('AED');
      expect(codes).toContain('SGD');
    });

    it('specifies 0 decimal places for non-fractional currencies like JPY', () => {
      const jpy = CURRENCIES.find((c) => c.code === 'JPY');
      expect(jpy).toBeDefined();
      expect(jpy.decimals).toBe(0);
    });

    it('specifies 2 decimal places for INR, USD, EUR', () => {
      const inr = CURRENCIES.find((c) => c.code === 'INR');
      const usd = CURRENCIES.find((c) => c.code === 'USD');
      const eur = CURRENCIES.find((c) => c.code === 'EUR');
      expect(inr.decimals).toBe(2);
      expect(usd.decimals).toBe(2);
      expect(eur.decimals).toBe(2);
    });
  });

  describe('toIndianNumberFormat()', () => {
    it('formats small numbers without extra grouping', () => {
      expect(toIndianNumberFormat(500)).toBe('500');
      expect(toIndianNumberFormat(1000)).toBe('1,000');
    });

    it('formats Indian Lakhs (1,00,000)', () => {
      expect(toIndianNumberFormat(100000)).toBe('1,00,000');
      expect(toIndianNumberFormat(250000)).toBe('2,50,000');
    });

    it('formats Indian Crores (1,00,00,000)', () => {
      expect(toIndianNumberFormat(10000000)).toBe('1,00,00,000');
      expect(toIndianNumberFormat(12500000)).toBe('1,25,00,000');
    });

    it('correctly handles negative values in Indian numbering system', () => {
      expect(toIndianNumberFormat(-150000)).toBe('-1,50,000');
    });

    it('preserves decimal fractions accurately', () => {
      expect(toIndianNumberFormat(1234567.89)).toBe('12,34,567.89');
    });
  });

  describe('formatCurrency()', () => {
    it('formats INR using Indian locale rules and Rupee symbol', () => {
      const formatted = formatCurrency(150000, 'INR');
      expect(formatted).toContain('1,50,000');
      // Matches either symbol ₹ or standard INR currency string
      expect(formatted).toMatch(/(₹|INR)/);
    });

    it('formats USD with 2 decimal places and dollar sign', () => {
      const formatted = formatCurrency(1250.5, 'USD');
      expect(formatted).toContain('1,250.50');
      expect(formatted).toMatch(/(\$|USD)/);
    });

    it('formats JPY without decimal fractions', () => {
      const formatted = formatCurrency(1250, 'JPY');
      expect(formatted).toContain('1,250');
      expect(formatted).not.toContain('.00');
    });
  });

  describe('formatCompact()', () => {
    it('formats INR in K, L (Lakhs), and Cr (Crores)', () => {
      expect(formatCompact(500, 'INR')).toBe('₹500');
      expect(formatCompact(5000, 'INR')).toBe('₹5K');
      expect(formatCompact(250000, 'INR')).toBe('₹2.5L');
      expect(formatCompact(15000000, 'INR')).toBe('₹1.5Cr');
    });

    it('formats Western currencies in K, M (Millions), and B (Billions)', () => {
      expect(formatCompact(5000, 'USD')).toBe('$5K');
      expect(formatCompact(2500000, 'USD')).toBe('$2.5M');
      expect(formatCompact(1500000000, 'USD')).toBe('$1.5B');
    });

    it('strips redundant trailing .0 in compact representation', () => {
      expect(formatCompact(100000, 'INR')).toBe('₹1L');
      expect(formatCompact(10000000, 'INR')).toBe('₹1Cr');
    });
  });

  describe('convert() and Fallback Behavior', () => {
    it('returns exact amount when fromCurrency equals toCurrency', () => {
      expect(convert(500, 'INR', 'INR')).toBe(500);
      expect(convert(120.75, 'USD', 'USD')).toBe(120.75);
    });

    it('returns original amount as safe fallback if exchange rates are not cached', () => {
      // Without calling fetchExchangeRates, ratesCache is null
      const converted = convert(100, 'USD', 'INR');
      expect(converted).toBe(100);
    });
  });

  describe('detectCurrencyFromLocale()', () => {
    it('detects INR for Indian English locale', () => {
      expect(detectCurrencyFromLocale('en-IN')).toBe('INR');
      expect(detectCurrencyFromLocale('hi-IN')).toBe('INR');
    });

    it('detects USD for US locale', () => {
      expect(detectCurrencyFromLocale('en-US')).toBe('USD');
    });

    it('detects EUR for German locale', () => {
      expect(detectCurrencyFromLocale('de-DE')).toBe('EUR');
    });

    it('detects JPY for Japanese locale', () => {
      expect(detectCurrencyFromLocale('ja-JP')).toBe('JPY');
    });

    it('defaults to USD for unknown or unrecognized locales', () => {
      expect(detectCurrencyFromLocale('xx-YY')).toBe('USD');
    });
  });
});
