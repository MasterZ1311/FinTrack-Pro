/**
 * FinTrack Pro — Unit Tests: Rule-Based & Learned Transaction Categorization
 */

import { describe, it, expect } from 'vitest';
import {
  ruleBasedCategorize,
  recordUserCorrection,
  getLearnedPattern,
  categorize,
} from '../../src/services/categorizer.js';

describe('Transaction Categorization Engine (src/services/categorizer.js)', () => {
  describe('ruleBasedCategorize() — Direct Merchant Matching', () => {
    it('categorizes popular food delivery services as Food & Dining', () => {
      const swiggy = ruleBasedCategorize('SWIGGY BANGALORE ORDER #1234');
      expect(swiggy).toEqual({ category: 'Food & Dining', confidence: 0.9, method: 'rules' });

      const zomato = ruleBasedCategorize('Zomato Limited Gurgaon');
      expect(zomato).toEqual({ category: 'Food & Dining', confidence: 0.9, method: 'rules' });

      const dominos = ruleBasedCategorize('Dominos Pizza Jubilee Hills');
      expect(dominos).toEqual({ category: 'Food & Dining', confidence: 0.9, method: 'rules' });
    });

    it('categorizes ride hailing services as Transport', () => {
      const uber = ruleBasedCategorize('Uber BV Amsterdam NL');
      expect(uber).toEqual({ category: 'Transport', confidence: 0.9, method: 'rules' });

      const ola = ruleBasedCategorize('Ola Cabs ANI Technologies');
      expect(ola).toEqual({ category: 'Transport', confidence: 0.9, method: 'rules' });
    });

    it('categorizes travel booking services as Travel', () => {
      const irctc = ruleBasedCategorize('IRCTC Indian Railways e-Ticketing');
      expect(irctc).toEqual({ category: 'Travel', confidence: 0.9, method: 'rules' });

      const mmt = ruleBasedCategorize('MakeMyTrip India Pvt Ltd');
      expect(mmt).toEqual({ category: 'Travel', confidence: 0.9, method: 'rules' });
    });

    it('categorizes e-commerce as Shopping', () => {
      const amazon = ruleBasedCategorize('Amazon India Payments');
      expect(amazon).toEqual({ category: 'Shopping', confidence: 0.9, method: 'rules' });

      const flipkart = ruleBasedCategorize('Flipkart Internet Private Limited');
      expect(flipkart).toEqual({ category: 'Shopping', confidence: 0.9, method: 'rules' });
    });

    it('categorizes telecom and utility bills as Bills & Utilities', () => {
      const airtel = ruleBasedCategorize('Airtel Postpaid Bill Payment');
      expect(airtel).toEqual({ category: 'Bills & Utilities', confidence: 0.9, method: 'rules' });

      const jio = ruleBasedCategorize('Reliance Jio Infocomm Ltd');
      expect(jio).toEqual({ category: 'Bills & Utilities', confidence: 0.9, method: 'rules' });
    });

    it('returns null for ambiguous payment gateways like Paytm and PhonePe', () => {
      expect(ruleBasedCategorize('Paytm Wallet Top-up')).toBeNull();
      expect(ruleBasedCategorize('PhonePe Transfer')).toBeNull();
    });

    it('returns null for unrecognized merchant strings', () => {
      expect(ruleBasedCategorize('XYZ Corner Store 9874')).toBeNull();
    });
  });

  describe('ruleBasedCategorize() — UPI & NEFT Extraction', () => {
    it('extracts merchant from UPI string pattern UPI/ref/desc/merchant', () => {
      const upiDesc = 'UPI/425619382104/Payment to Swiggy/swiggy@icici/Order123';
      const result = ruleBasedCategorize(upiDesc);
      expect(result).not.toBeNull();
      expect(result.category).toBe('Food & Dining');
      expect(result.method).toMatch(/rules/);
    });

    it('extracts merchant from NEFT string pattern NEFT-IFSC-MerchantName', () => {
      const neftDesc = 'NEFT-HDFC0000001-Uber India Tech-Mumbai';
      const result = ruleBasedCategorize(neftDesc);
      expect(result).not.toBeNull();
      expect(result.category).toBe('Transport');
    });
  });

  describe('User Corrections & Learned Patterns', () => {
    it('records and remembers user corrections in cache', () => {
      const desc = 'Sharma Tea Stall Koramangala';
      recordUserCorrection(desc, 'Food & Dining');

      const learned = getLearnedPattern(desc);
      expect(learned).toBe('Food & Dining');
    });

    it('is case-insensitive when looking up learned patterns', () => {
      recordUserCorrection('local gym subscription', 'Fitness');
      expect(getLearnedPattern('LOCAL GYM SUBSCRIPTION')).toBe('Fitness');
    });

    it('prioritizes user learned patterns over rule-based categorization', async () => {
      // Swiggy is normally Food & Dining, but user remapped this specific merchant to 'Office Expenses'
      const customSwiggy = 'SWIGGY CORPORATE CATERING';
      recordUserCorrection(customSwiggy, 'Office Expenses');

      const result = await categorize(customSwiggy);
      expect(result.category).toBe('Office Expenses');
      expect(result.confidence).toBe(1.0);
      expect(result.method).toBe('learned');
    });

    it('falls back to Uncategorized with confidence 0 when neither rules nor AI nor learned matches', async () => {
      const result = await categorize('Completely Unknown 999');
      expect(result.category).toBe('Uncategorized');
      expect(result.confidence).toBe(0);
    });
  });
});
