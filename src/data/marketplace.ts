import type { Purpose } from "@/data/banks";

/**
 * Types retained for the original marketplace/offer discussion flow.
 *
 * Public offers must be source-backed records from the reviewed D1 workflow.
 * There are intentionally no bundled requests, bank bids, or rate fixtures.
 */
export type MarketOffer = {
  id: string;
  code: string;
  rate: number;
  listed: number;
  termMonths: number;
  maxAmount: number;
  conditions: string[];
  hoursAgo: number;
  expiresInH: number;
};

export type MarketPost = {
  id: string;
  handle: string;
  purpose: Purpose;
  amount: number;
  termMonths: number;
  incomeBand: string;
  collateral: boolean;
  verified: string[];
  noteKey?: string;
  note?: string;
  hoursAgo: number;
  offers: MarketOffer[];
  mine?: boolean;
};

export const INCOME_BANDS = ["mk_inc_1", "mk_inc_2", "mk_inc_3", "mk_inc_4"];

/** No public marketplace seed data: real provider/customer workflow only. */
export const SEED_POSTS: MarketPost[] = [];
