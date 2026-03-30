// Shared utilities used by both content script and tests

export const emailRegex = RegExp(
	/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/i,
);

type SensitiveTextPattern = {
	regex: RegExp;
	mask: (value: string) => string;
};

export type SensitiveTextMatch = {
	start: number;
	end: number;
	original: string;
	masked: string;
};

const maskEmail = (value: string) =>
	value
		.split("@")
		.map((part) => part.replace(/./g, "*"))
		.join("@");

const maskSecret = (value: string) => value.replace(/[A-Za-z0-9]/g, "*");

const maskPrivateKey = (value: string) => value.replace(/[A-Za-z0-9+/=]/g, "*");

export const sensitiveTextPatterns: SensitiveTextPattern[] = [
	{
		regex: new RegExp(emailRegex.source, "gi"),
		mask: maskEmail,
	},
	{
		regex: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/gi,
		mask: maskSecret,
	},
	{
		regex: /\bAIza[0-9A-Za-z\-_]{20,}\b/g,
		mask: maskSecret,
	},
	{
		regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,255}\b/g,
		mask: maskSecret,
	},
	{
		regex: /\bgithub_pat_[A-Za-z0-9_]{20,255}\b/g,
		mask: maskSecret,
	},
	{
		regex: /\bxox(?:a|b|p|o|r|s)-[A-Za-z0-9-]{10,}\b/g,
		mask: maskSecret,
	},
	{
		regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
		mask: maskSecret,
	},
	{
		regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9._-]{8,}\.[A-Za-z0-9._-]{8,}\b/g,
		mask: maskSecret,
	},
	{
		regex: /\bBearer\s+[A-Za-z0-9\-._~+/]{16,}={0,2}\b/gi,
		mask: maskSecret,
	},
	{
		regex:
			/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
		mask: maskPrivateKey,
	},
];

export const sensitiveKeywords = [
	"password",
	"pass",
	"secret",
	"token",
	"api",
	"key",
	"auth",
	"session",
	"ssn",
	"social",
	"credit",
	"card",
	"cvv",
	"cvc",
	"pin",
	"email",
	"e-mail",
	"mail",
	"phone",
	"tel",
];

export const sensitiveAutocompleteValues = new Set([
	"current-password",
	"new-password",
	"one-time-code",
	"cc-number",
	"cc-csc",
	"cc-exp",
	"cc-exp-month",
	"cc-exp-year",
	"cc-name",
	"email",
	"tel",
]);

export const parseSelectors = (raw: unknown): string[] => {
	if (typeof raw !== "string") return [];

	const selectors: string[] = [];
	let current = "";
	let parenDepth = 0;
	let bracketDepth = 0;
	let quote: '"' | "'" | null = null;
	let escaped = false;

	const pushCurrent = () => {
		const selector = current.trim();
		if (selector) selectors.push(selector);
		current = "";
	};

	for (const char of raw) {
		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}

		if (quote) {
			current += char;

			if (char === "\\") {
				escaped = true;
				continue;
			}

			if (char === quote) {
				quote = null;
			}
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			current += char;
			continue;
		}

		if (char === "(") {
			parenDepth++;
			current += char;
			continue;
		}

		if (char === ")") {
			if (parenDepth > 0) parenDepth--;
			current += char;
			continue;
		}

		if (char === "[") {
			bracketDepth++;
			current += char;
			continue;
		}

		if (char === "]") {
			if (bracketDepth > 0) bracketDepth--;
			current += char;
			continue;
		}

		const isDelimiter = char === "," || char === "\n" || char === "\r";
		if (isDelimiter && parenDepth === 0 && bracketDepth === 0) {
			pushCurrent();
			continue;
		}

		current += char;
	}

	pushCurrent();
	return selectors;
};

export const normalizeValue = (value?: string | null) =>
	(value ?? "").toLowerCase();

export const collectSensitiveTextMatches = (
	value: unknown,
): SensitiveTextMatch[] => {
	if (typeof value !== "string" || value.length === 0) return [];

	const matches: SensitiveTextMatch[] = [];

	for (const pattern of sensitiveTextPatterns) {
		const flags = pattern.regex.flags.includes("g")
			? pattern.regex.flags
			: `${pattern.regex.flags}g`;
		const matcher = new RegExp(pattern.regex.source, flags);
		let match = matcher.exec(value);

		while (match !== null) {
			const matchedText = match[0];
			if (matchedText.length === 0) {
				matcher.lastIndex += 1;
				match = matcher.exec(value);
				continue;
			}

			matches.push({
				start: match.index,
				end: match.index + matchedText.length,
				original: matchedText,
				masked: pattern.mask(matchedText),
			});

			match = matcher.exec(value);
		}
	}

	matches.sort(
		(left, right) =>
			left.start - right.start || right.original.length - left.original.length,
	);

	const deduped: SensitiveTextMatch[] = [];
	let lastEnd = -1;
	for (const match of matches) {
		if (match.start < lastEnd) continue;
		deduped.push(match);
		lastEnd = match.end;
	}

	return deduped;
};

export const containsSensitiveValue = (value?: string | null) =>
	collectSensitiveTextMatches(value).length > 0;

export const hasSensitiveKeyword = (value?: string | null) => {
	const normalized = normalizeValue(value);
	return sensitiveKeywords.some((keyword) => normalized.includes(keyword));
};

export const isSensitiveField = (
	element: HTMLInputElement | HTMLTextAreaElement | HTMLElement,
) => {
	if (element instanceof HTMLInputElement) {
		const type = normalizeValue(element.type);
		// Skip hidden inputs - they're not visible to the user
		if (type === "hidden") return false;
		if (type === "password" || type === "email" || type === "tel") return true;
	}

	const autocomplete = normalizeValue(element.getAttribute("autocomplete"));
	if (autocomplete && sensitiveAutocompleteValues.has(autocomplete))
		return true;

	return [
		element.getAttribute("name"),
		element.getAttribute("id"),
		element.getAttribute("aria-label"),
		element.getAttribute("placeholder"),
		element.getAttribute("data-testid"),
	].some(hasSensitiveKeyword);
};
