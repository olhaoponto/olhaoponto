import { describe, expect, it } from "vitest";
import { calculateWelcomeFrame } from "../utils/welcome-frame";

describe("welcome frame", () => {
  it("fits a 1080x2340 scene in wide and low viewports", () => {
    const frame = calculateWelcomeFrame(1366, 768, 1080, 2340);

    expect(frame.height).toBe(768);
    expect(frame.width).toBeCloseTo(768 * (1080 / 2340));
    expect(frame.left).toBeCloseTo((1366 - frame.width) / 2);
    expect(frame.top).toBe(0);
  });

  it("also keeps the full scene in a 1920x1080 viewport", () => {
    const frame = calculateWelcomeFrame(1920, 1080, 1080, 2340);

    expect(frame.height).toBe(1080);
    expect(frame.width).toBeCloseTo(1080 * (1080 / 2340));
    expect(frame.left).toBeCloseTo((1920 - frame.width) / 2);
  });

  it("uses the available width in a portrait viewport", () => {
    const frame = calculateWelcomeFrame(390, 844, 1080, 2340);

    expect(frame.height).toBe(844);
    expect(frame.width).toBeCloseTo(844 * (1080 / 2340));
    expect(frame.top).toBeCloseTo((844 - frame.height) / 2);
  });
});
