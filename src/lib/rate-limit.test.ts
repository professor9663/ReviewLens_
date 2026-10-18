import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("best-effort request limits", () => {
  it("allows the configured number of calls and returns a retry interval after the limit", () => {
    const key = `unit:${crypto.randomUUID()}`;
    expect(checkRateLimit(key, 2, 1000, 100).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 1000, 101).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 1000, 200)).toEqual({ allowed: false, retryAfter: 1 });
  });
  it("resets a window after it expires", () => {
    const key = `unit:${crypto.randomUUID()}`;
    expect(checkRateLimit(key, 1, 1000, 0).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 1000, 1000).allowed).toBe(true);
  });
});
