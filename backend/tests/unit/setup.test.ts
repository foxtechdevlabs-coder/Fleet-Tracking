// Jest infrastructure smoke test.
import { describe, expect, it } from "@jest/globals";

describe("test platform", () => {
  it("runs TypeScript tests", () => {
    const sum: number = 1 + 1;
    expect(sum).toBe(2);
  });
});
