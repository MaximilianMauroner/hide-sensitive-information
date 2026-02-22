import { describe, expect, test } from "bun:test";

import "./setup";
import { emailRegex, isSensitiveField } from "../shared";

function createTestElement<T extends HTMLElement = HTMLElement>(
	html: string,
): T {
	document.body.innerHTML = html;
	return document.body.firstElementChild as T;
}

describe("Sensitive field detection - Input types", () => {
	test("detects password input type", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>('<input type="password" />'),
			),
		).toBe(true);
	});

	test("detects email input type", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>('<input type="email" />'),
			),
		).toBe(true);
	});

	test("detects tel input type", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>('<input type="tel" />'),
			),
		).toBe(true);
	});
});

describe("Sensitive field detection - Autocomplete attributes", () => {
	test("detects current-password autocomplete", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>(
					'<input autocomplete="current-password" />',
				),
			),
		).toBe(true);
	});

	test("detects new-password autocomplete", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>(
					'<input autocomplete="new-password" />',
				),
			),
		).toBe(true);
	});

	test("detects cc-number autocomplete", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>(
					'<input autocomplete="cc-number" />',
				),
			),
		).toBe(true);
	});
});

describe("Sensitive field detection - Attributes", () => {
	test("detects password in name", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>('<input name="user-password" />'),
			),
		).toBe(true);
	});

	test("detects email in name", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>('<input name="user-email" />'),
			),
		).toBe(true);
	});

	test("detects token in name", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>('<input name="api-token" />'),
			),
		).toBe(true);
	});

	test("detects password in id", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>('<input id="user-password" />'),
			),
		).toBe(true);
	});

	test("detects password in aria-label", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>(
					'<input aria-label="User Password" />',
				),
			),
		).toBe(true);
	});

	test("detects password in placeholder", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>(
					'<input placeholder="Enter your password" />',
				),
			),
		).toBe(true);
	});

	test("detects password in data-testid", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>(
					'<input data-testid="password-input" />',
				),
			),
		).toBe(true);
	});
});

describe("Sensitive field detection - Safe fields", () => {
	test("returns false for username field", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>(
					'<input type="text" name="username" />',
				),
			),
		).toBe(false);
	});

	test("returns false for name field", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>(
					'<input type="text" name="full-name" />',
				),
			),
		).toBe(false);
	});

	test("returns false for address field", () => {
		expect(
			isSensitiveField(
				createTestElement<HTMLInputElement>(
					'<input type="text" name="address" />',
				),
			),
		).toBe(false);
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
