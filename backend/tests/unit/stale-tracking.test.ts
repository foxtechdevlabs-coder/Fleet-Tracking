// Tests for stale/offline evaluation logic, timestamp selection, speed conversions, and timezone formatting.
import { describe, expect, it } from "@jest/globals";
import {
  convertSpeed,
  evaluateTrackingStatus,
  formatTimeWithTimezone,
  getEffectiveTimestamp,
  isRecordStale,
  isValidTimezone,
} from "../../src/modules/tracking/tracking-status.util.js";

describe("Tracking Status, Stale Logic & Unit Conversions", () => {
  const baseNow = new Date("2026-10-15T12:00:00.000Z");

  describe("Timestamp Selection (Task 12)", () => {
    it("crucially prioritizes hardware recorded_at over server ingested_at", () => {
      const hardwareTime = new Date("2026-10-15T11:45:00.000Z"); // 15 mins ago
      const serverReceiptTime = new Date("2026-10-15T11:59:00.000Z"); // 1 min ago

      const effective = getEffectiveTimestamp({
        recordedAt: hardwareTime,
        ingestedAt: serverReceiptTime,
      });

      expect(effective).toEqual(hardwareTime);
    });

    it("falls back to ingested_at when recorded_at is null or missing", () => {
      const serverReceiptTime = new Date("2026-10-15T11:59:00.000Z");
      const effective = getEffectiveTimestamp({
        recordedAt: null,
        ingestedAt: serverReceiptTime,
      });

      expect(effective).toEqual(serverReceiptTime);
    });

    it("returns null when all timestamps are missing or invalid", () => {
      expect(getEffectiveTimestamp({})).toBeNull();
      expect(getEffectiveTimestamp({ recordedAt: "invalid-date" })).toBeNull();
    });
  });

  describe("Stale / Active Status Evaluation (Tasks 11, 12, 15)", () => {
    const thresholdSeconds = 300; // 5 minutes

    it("evaluates to 'moving' when recent and speed > 0", () => {
      const recentTimestamp = new Date("2026-10-15T11:58:00.000Z"); // 2 minutes ago
      const status = evaluateTrackingStatus({
        recordedAt: recentTimestamp,
        speed: 45.0,
        staleThresholdSeconds: thresholdSeconds,
        now: baseNow,
      });

      expect(status).toBe("moving");
    });

    it("evaluates to 'idle' when recent and speed is 0 or stationary", () => {
      const recentTimestamp = new Date("2026-10-15T11:58:00.000Z"); // 2 minutes ago
      const status = evaluateTrackingStatus({
        recordedAt: recentTimestamp,
        speed: 0,
        staleThresholdSeconds: thresholdSeconds,
        now: baseNow,
      });

      expect(status).toBe("idle");
    });

    it("evaluates to 'stale' when elapsed time exceeds stale threshold based on recorded_at", () => {
      // Hardware timestamp captured 10 minutes ago, even if ingested 30s ago
      const recordedAt = new Date("2026-10-15T11:50:00.000Z"); // 10 mins ago (> 300s)
      const ingestedAt = new Date("2026-10-15T11:59:30.000Z"); // 30s ago

      const status = evaluateTrackingStatus({
        recordedAt,
        ingestedAt,
        speed: 60.0,
        staleThresholdSeconds: thresholdSeconds,
        now: baseNow,
      });

      expect(status).toBe("stale");
    });

    it("correctly identifies isRecordStale", () => {
      const fresh = new Date("2026-10-15T11:56:00.000Z"); // 4 mins ago <= 5 mins
      const stale = new Date("2026-10-15T11:54:00.000Z"); // 6 mins ago > 5 mins

      expect(isRecordStale(fresh, 300, baseNow)).toBe(false);
      expect(isRecordStale(stale, 300, baseNow)).toBe(true);
      expect(isRecordStale(null, 300, baseNow)).toBe(true);
    });

    it("evaluates to 'offline' when no valid timestamp is available", () => {
      const status = evaluateTrackingStatus({
        recordedAt: null,
        ingestedAt: null,
        now: baseNow,
      });

      expect(status).toBe("offline");
    });
  });

  describe("Speed Unit Conversion (Tasks 14, 15)", () => {
    it("preserves km/h values as stored without conversion", () => {
      expect(convertSpeed(100, "km/h")).toBe(100);
      expect(convertSpeed(0, "km/h")).toBe(0);
      expect(convertSpeed(null, "km/h")).toBeNull();
      expect(convertSpeed(undefined, "km/h")).toBeNull();
    });

    it("converts km/h to mph rounded to 2 decimal places using factor 0.621371", () => {
      // 100 km/h * 0.621371 = 62.14 mph
      expect(convertSpeed(100, "mph")).toBe(62.14);
      // 45.5 km/h * 0.621371 = 28.2723805 -> 28.27 mph
      expect(convertSpeed(45.5, "mph")).toBe(28.27);
      // 0 km/h = 0 mph
      expect(convertSpeed(0, "mph")).toBe(0);
    });
  });

  describe("Timezone Formatting (Task 13)", () => {
    it("validates standard IANA timezone identifiers", () => {
      expect(isValidTimezone("UTC")).toBe(true);
      expect(isValidTimezone("Asia/Kolkata")).toBe(true);
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("Europe/London")).toBe(true);

      expect(isValidTimezone("")).toBe(false);
      expect(isValidTimezone("Invalid/Zone")).toBe(false);
      expect(isValidTimezone("GMT+5")).toBe(false);
    });

    it("formats UTC timestamp as ISO-8601 string", () => {
      const d = new Date("2026-10-15T12:00:00.000Z");
      expect(formatTimeWithTimezone(d, "UTC")).toBe("2026-10-15T12:00:00.000Z");
    });

    it("formats timestamp in target timezone with appropriate offset", () => {
      const d = new Date("2026-10-15T12:00:00.000Z");
      // Asia/Kolkata is UTC+05:30 -> 17:30
      const kolkata = formatTimeWithTimezone(d, "Asia/Kolkata");
      expect(kolkata).toContain("2026-10-15T17:30:00");
      expect(kolkata).toContain("+05:30");
    });
  });
});
