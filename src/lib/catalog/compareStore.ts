"use client";

import { useSyncExternalStore } from "react";

export const CATALOG_COMPARE_MAX = 3;
const KEY = "vaytiendanang_catalog_compare";
const EMPTY: string[] = [];
let ids: string[] = EMPTY;
let started = false;
const subscribers = new Set<() => void>();

function emit() {
  subscribers.forEach((subscriber) => subscriber());
}

function read(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return EMPTY;
    return value
      .filter((item): item is string => typeof item === "string" && item.length <= 160)
      .slice(0, CATALOG_COMPARE_MAX);
  } catch {
    return EMPTY;
  }
}

function subscribe(callback: () => void) {
  if (!started) {
    started = true;
    ids = read();
    window.addEventListener("storage", (event) => {
      if (event.key === KEY) {
        ids = read();
        emit();
      }
    });
  }
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function commit(next: string[]) {
  ids = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // The current tab still works if storage is unavailable.
  }
  emit();
}

export function useCatalogCompare(): string[] {
  return useSyncExternalStore(subscribe, () => ids, () => EMPTY);
}

export function toggleCatalogCompare(slug: string): "added" | "removed" | "full" {
  if (ids.includes(slug)) {
    commit(ids.filter((id) => id !== slug));
    return "removed";
  }
  if (ids.length >= CATALOG_COMPARE_MAX) return "full";
  commit([...ids, slug]);
  return "added";
}

export function removeCatalogCompare(slug: string) {
  if (ids.includes(slug)) commit(ids.filter((id) => id !== slug));
}

export function clearCatalogCompare() {
  if (ids.length) commit(EMPTY);
}
