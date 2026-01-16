import { describe, test, expect } from "bun:test";
import { Window } from "happy-dom";
import { emailRegex } from "../shared";

// Helper to create a DOM element for testing
function createTestElement(html: string): HTMLElement {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

// Simplified isSensitiveField for testing
function testIsSensitiveField(element: HTMLElement): boolean {
  const sensitiveKeywords = [
    "password", "pass", "secret", "token", "api", "key", "auth", "session",
    "ssn", "social", "credit", "card", "cvv", "cvc", "pin", "email",
    "e-mail", "mail", "phone", "tel",
  ];

  const sensitiveAutocompleteValues = new Set([
    "current-password", "new-password", "one-time-code", "cc-number",
    "cc-csc", "cc-exp", "cc-exp-month", "cc-exp-year", "cc-name", "email", "tel",
  ]);

  const normalizeValue = (value?: string | null) => (value ?? "").toLowerCase();
  const hasSensitiveKeyword = (value?: string | null) => {
    const normalized = normalizeValue(value);
    return sensitiveKeywords.some((keyword) => normalized.includes(keyword));
  };

  if (element.tagName === "INPUT") {
    const type = normalizeValue((element as any).type);
    if (type === "password" || type === "email" || type === "tel") return true;
  }

  const autocomplete = normalizeValue(element.getAttribute("autocomplete"));
  if (autocomplete && sensitiveAutocompleteValues.has(autocomplete)) return true;

  return [
    element.getAttribute("name"),
    element.getAttribute("id"),
    element.getAttribute("aria-label"),
    element.getAttribute("placeholder"),
    element.getAttribute("data-testid"),
  ].some(hasSensitiveKeyword);
}

describe("Sensitive field detection - Input types", () => {
  test("detects password input type", () => {
    expect(testIsSensitiveField(createTestElement('<input type="password" />'))).toBe(true);
  });

  test("detects email input type", () => {
    expect(testIsSensitiveField(createTestElement('<input type="email" />'))).toBe(true);
  });

  test("detects tel input type", () => {
    expect(testIsSensitiveField(createTestElement('<input type="tel" />'))).toBe(true);
  });
});

describe("Sensitive field detection - Autocomplete attributes", () => {
  test("detects current-password autocomplete", () => {
    expect(testIsSensitiveField(createTestElement('<input autocomplete="current-password" />'))).toBe(true);
  });

  test("detects new-password autocomplete", () => {
    expect(testIsSensitiveField(createTestElement('<input autocomplete="new-password" />'))).toBe(true);
  });

  test("detects cc-number autocomplete", () => {
    expect(testIsSensitiveField(createTestElement('<input autocomplete="cc-number" />'))).toBe(true);
  });
});

describe("Sensitive field detection - Attributes", () => {
  test("detects password in name", () => {
    expect(testIsSensitiveField(createTestElement('<input name="user-password" />'))).toBe(true);
  });

  test("detects email in name", () => {
    expect(testIsSensitiveField(createTestElement('<input name="user-email" />'))).toBe(true);
  });

  test("detects token in name", () => {
    expect(testIsSensitiveField(createTestElement('<input name="api-token" />'))).toBe(true);
  });

  test("detects password in id", () => {
    expect(testIsSensitiveField(createTestElement('<input id="user-password" />'))).toBe(true);
  });

  test("detects password in aria-label", () => {
    expect(testIsSensitiveField(createTestElement('<input aria-label="User Password" />'))).toBe(true);
  });

  test("detects password in placeholder", () => {
    expect(testIsSensitiveField(createTestElement('<input placeholder="Enter your password" />'))).toBe(true);
  });

  test("detects password in data-testid", () => {
    expect(testIsSensitiveField(createTestElement('<input data-testid="password-input" />'))).toBe(true);
  });
});

describe("Sensitive field detection - Safe fields", () => {
  test("returns false for username field", () => {
    expect(testIsSensitiveField(createTestElement('<input type="text" name="username" />'))).toBe(false);
  });

  test("returns false for name field", () => {
    expect(testIsSensitiveField(createTestElement('<input type="text" name="full-name" />'))).toBe(false);
  });

  test("returns false for address field", () => {
    expect(testIsSensitiveField(createTestElement('<input type="text" name="address" />'))).toBe(false);
  });
});

describe("Email regex", () => {
  test("matches valid emails", () => {
    expect("user@example.com".match(emailRegex)).toBeTruthy();
    expect("test.user@domain.co.uk".match(emailRegex)).toBeTruthy();
    expect("name+tag@gmail.com".match(emailRegex)).toBeTruthy();
  });

  test("matches emails with numbers", () => {
    expect("user123@example.com".match(emailRegex)).toBeTruthy();
    expect("1234567890@example.com".match(emailRegex)).toBeTruthy();
  });

  test("does not match invalid patterns", () => {
    expect("notanemail".match(emailRegex)).toBeFalsy();
    expect("@example.com".match(emailRegex)).toBeFalsy();
    expect("user@".match(emailRegex)).toBeFalsy();
  });

  test("is case insensitive", () => {
    expect("User@Example.COM".match(emailRegex)).toBeTruthy();
    expect("USER@EXAMPLE.COM".match(emailRegex)).toBeTruthy();
  });
});
