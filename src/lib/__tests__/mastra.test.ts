// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { DEFAULT_MASTRA_MODEL, runMunshiViaMastra } from '@/lib/ai/mastra-agent';
import type { ShopContext } from '@/lib/ai/munshi';
import { SEED_CUSTOMERS, SEED_EXPENSES, SEED_PRODUCTS } from '@/lib/seed';

function ctx(overrides: Partial<ShopContext> = {}): ShopContext {
  return {
    products: SEED_PRODUCTS,
    customers: SEED_CUSTOMERS,
    transactions: [],
    expenses: SEED_EXPENSES,
    cashClosings: [],
    ...overrides,
  };
}

describe('Mastra orchestration adapter', () => {
  test('uses a Gemma model by default', () => {
    expect(DEFAULT_MASTRA_MODEL).toMatch(/gemma/i);
  });

  test('falls back to the deterministic agent when no model is reachable', async () => {
    // An unknown provider makes Mastra fail fast, without any network call.
    const result = await runMunshiViaMastra('kam stock batao', ctx(), 'invalid-provider/does-not-exist');

    expect(result.ok).toBe(false);
    if (result.ok) return; // narrow for TypeScript
    expect(result.via).toBe('fallback');
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
    // The shopkeeper still gets a real, correct answer.
    expect(result.data.intent).toBe('low_stock');
    expect(result.data.reply.en.length).toBeGreaterThan(0);
    expect(result.data.reply.ur.length).toBeGreaterThan(0);
  }, 20000);
});
