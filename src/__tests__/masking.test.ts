import { describe, expect, test } from "bun:test";

import "./setup";
import {
	collectSensitiveTextMatches,
	containsSensitiveValue,
	emailRegex,
	isSensitiveField,
} from "../shared";

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

describe("Sensitive value detection", () => {
	test("detects Stripe-style API keys", () => {
		const stripeLikeApiKey = ["sk", "live", "1234567890abcdefghijklmnop"].join(
			"_",
		);
		expect(containsSensitiveValue(stripeLikeApiKey)).toBe(true);
	});

	test("detects GitHub personal access tokens", () => {
		expect(containsSensitiveValue("ghp_1234567890abcdefghijklmnopqrstuv")).toBe(
			true,
		);
	});

	test("detects JWT tokens", () => {
		expect(
			containsSensitiveValue(
				"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NvdW50IjoidGVzdC11c2VyIn0.signatureToken123456",
			),
		).toBe(true);
	});

	test("detects AWS access keys", () => {
		expect(containsSensitiveValue("AKIAIOSFODNN7EXAMPLE")).toBe(true);
	});

	test("returns false for regular text", () => {
		expect(containsSensitiveValue("hello world")).toBe(false);
		expect(containsSensitiveValue("build status: passing")).toBe(false);
	});
});

describe("Sensitive text matching", () => {
	test("collects both emails and API keys from visible text", () => {
		const stripeLikeApiKey = ["sk", "live", "1234567890abcdefghijklmnop"].join(
			"_",
		);
		const matches = collectSensitiveTextMatches(
			`Email me at user@example.com or use ${stripeLikeApiKey}`,
		);

		expect(matches).toHaveLength(2);
		expect(matches[0]?.original).toBe("user@example.com");
		expect(matches[0]?.masked).toBe("****@***********");
		expect(matches[1]?.original).toBe(stripeLikeApiKey);
		expect(matches[1]?.masked).toContain("********");
	});
});
