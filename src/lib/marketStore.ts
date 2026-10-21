"use client";

/**
 * Requests the user has posted to the reverse-auction board, plus the offers
 * that came back.
 *
 * Kept in the same external-store shape as the compare basket so the board can
 * be reached from anywhere and survives a refresh — which matters here, because
 * the whole point of the mechanic is that you post once and come back later to
 * find the banks have bid.
 */
import { useSyncExternalStore } from "react";
import type { MarketPost } from "@/data/marketplace";

const KEY = "vaya_market_posts";
const EMPTY: MarketPost[] = [];

let posts: MarketPost[] = EMPTY;
let loaded = false;
let listening = false;
const subs = new Set<() => void>();

function emit() {
  // See compareStore: no `target` in tsconfig means ES5, which cannot iterate a
  // Set with for..of.
  subs.forEach((cb) => cb());
}

function read(): MarketPost[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length
      ? (parsed as MarketPost[])
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (!loaded) {
    loaded = true;
    const saved = read();
    if (saved !== EMPTY) posts = saved;
  }
}

function subscribe(cb: () => void) {
  ensureLoaded();
  if (!listening) {
    listening = true;
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) {
        posts = read();
        emit();
      }
    });
  }
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

const getSnapshot = () => posts;
const getServerSnapshot = () => EMPTY;

/** Reactive list of the requests this user has posted. */
export function useMyPosts(): MarketPost[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Imperative snapshot of the posted requests. Lazy-loads from localStorage
 * like `subscribe` does, but without React or the cross-tab listener — for
 * one-off offer resolution (e.g. the `?offer=` URL param at chat boot).
 */
export function getPosts(): MarketPost[] {
  ensureLoaded();
  return posts;
}

/**
 * There is deliberately no local post/bid creator. A provider offer is a
 * regulated, time-sensitive fact and must arrive through the reviewed D1
 * workflow. This store only reads old, user-owned local posts so existing
 * offer discussions can be reopened without inventing a quote.
 */
