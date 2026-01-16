import { describe, test, expect } from "bun:test";
import {
  parseSelectors,
  normalizeValue,
  hasSensitiveKeyword,
  sensitiveKeywords,
} from "../shared";

describe("Selector parsing", () => {
  test("parseSelectors splits by comma", () => {
    const input = ".class1, .class2, .class3";
    const result = parseSelectors(input);
    expect(result).toEqual([".class1", ".class2", ".class3"]);
  });

  test("parseSelectors splits by newline", () => {
    const input = ".class1\n.class2\n.class3";
    const result = parseSelectors(input);
    expect(result).toEqual([".class1", ".class2", ".class3"]);
  });

  test("parseSelectors splits by mixed comma and newline", () => {
    const input = ".class1,\n.class2\n.class3, .class4";
    const result = parseSelectors(input);
    expect(result).toEqual([".class1", ".class2", ".class3", ".class4"]);
  });

  test("parseSelectors trims whitespace", () => {
    const input = "  .class1  ,  .class2  ";
    const result = parseSelectors(input);
    expect(result).toEqual([".class1", ".class2"]);
  });

  test("parseSelectors filters empty strings", () => {
    const input = ".class1,,,.class2";
    const result = parseSelectors(input);
    expect(result).toEqual([".class1", ".class2"]);
  });

  test("parseSelectors handles non-string input", () => {
    expect(parseSelectors(null)).toEqual([]);
    expect(parseSelectors(undefined)).toEqual([]);
    expect(parseSelectors(123 as any)).toEqual([]);
    expect(parseSelectors({} as any)).toEqual([]);
    expect(parseSelectors([] as any)).toEqual([]);
  });

  test("parseSelectors handles empty string", () => {
    expect(parseSelectors("")).toEqual([]);
  });

  test("parseSelectors handles complex selectors", () => {
    const input = "div > .class1, input[name='password'], #email-field";
    const result = parseSelectors(input);
    expect(result).toEqual([
      "div > .class1",
      "input[name='password']",
      "#email-field",
    ]);
  });
});

describe("Value normalization", () => {
  test("normalizeValue converts to lowercase", () => {
    expect(normalizeValue("PASSWORD")).toBe("password");
    expect(normalizeValue("Email")).toBe("email");
    expect(normalizeValue("MixedCase")).toBe("mixedcase");
  });

  test("normalizeValue handles null/undefined", () => {
    expect(normalizeValue(null)).toBe("");
    expect(normalizeValue(undefined)).toBe("");
  });

  test("normalizeValue handles empty string", () => {
    expect(normalizeValue("")).toBe("");
  });

  test("normalizeValue preserves non-alphabetic characters", () => {
    expect(normalizeValue("user-email123")).toBe("user-email123");
    expect(normalizeValue("api_key_1")).toBe("api_key_1");
  });
});

describe("Sensitive keyword detection", () => {
  test("hasSensitiveKeyword detects password variants", () => {
    expect(hasSensitiveKeyword("user-password")).toBe(true);
    expect(hasSensitiveKeyword("PASSWORD")).toBe(true);
    expect(hasSensitiveKeyword("mypass")).toBe(true);
    expect(hasSensitiveKeyword("confirmPassword")).toBe(true);
  });

  test("hasSensitiveKeyword detects email variants", () => {
    expect(hasSensitiveKeyword("user-email")).toBe(true);
    expect(hasSensitiveKeyword("e-mail-address")).toBe(true);
    expect(hasSensitiveKeyword("mailbox")).toBe(true);
  });

  test("hasSensitiveKeyword detects token/api/key", () => {
    expect(hasSensitiveKeyword("api-token")).toBe(true);
    expect(hasSensitiveKeyword("auth-key")).toBe(true);
    expect(hasSensitiveKeyword("session-id")).toBe(true);
    expect(hasSensitiveKeyword("apiKey")).toBe(true);
  });

  test("hasSensitiveKeyword detects credit card related", () => {
    expect(hasSensitiveKeyword("credit-card-number")).toBe(true);
    expect(hasSensitiveKeyword("card-cvv")).toBe(true);
    expect(hasSensitiveKeyword("cvc-code")).toBe(true);
  });

  test("hasSensitiveKeyword detects social security", () => {
    expect(hasSensitiveKeyword("ssn")).toBe(true);
    expect(hasSensitiveKeyword("social-security")).toBe(true);
  });

  test("hasSensitiveKeyword detects phone/tel", () => {
    expect(hasSensitiveKeyword("phone-number")).toBe(true);
    expect(hasSensitiveKeyword("telephone")).toBe(true);
  });

  test("hasSensitiveKeyword detects pin", () => {
    expect(hasSensitiveKeyword("pin-code")).toBe(true);
    expect(hasSensitiveKeyword("atm-pin")).toBe(true);
  });

  test("hasSensitiveKeyword returns false for safe keywords", () => {
    expect(hasSensitiveKeyword("username")).toBe(false);
    expect(hasSensitiveKeyword("full-name")).toBe(false);
    expect(hasSensitiveKeyword("address")).toBe(false);
    expect(hasSensitiveKeyword("city")).toBe(false);
    expect(hasSensitiveKeyword("country")).toBe(false);
  });

  test("hasSensitiveKeyword is case insensitive", () => {
    expect(hasSensitiveKeyword("PASSWORD")).toBe(true);
    expect(hasSensitiveKeyword("Password")).toBe(true);
    expect(hasSensitiveKeyword("password")).toBe(true);
    expect(hasSensitiveKeyword("PaSsWoRd")).toBe(true);
  });

  test("hasSensitiveKeyword handles null/undefined", () => {
    expect(hasSensitiveKeyword(null)).toBe(false);
    expect(hasSensitiveKeyword(undefined)).toBe(false);
  });

  test("hasSensitiveKeyword handles empty string", () => {
    expect(hasSensitiveKeyword("")).toBe(false);
  });
});

describe("Sensitive keywords array", () => {
  test("sensitiveKeywords contains expected values", () => {
    expect(sensitiveKeywords).toContain("password");
    expect(sensitiveKeywords).toContain("email");
    expect(sensitiveKeywords).toContain("token");
    expect(sensitiveKeywords).toContain("api");
    expect(sensitiveKeywords).toContain("key");
    expect(sensitiveKeywords).toContain("credit");
    expect(sensitiveKeywords).toContain("card");
  });

  test("sensitiveKeywords is not empty", () => {
    expect(sensitiveKeywords.length).toBeGreaterThan(0);
  });
});
