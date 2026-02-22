import { emailRegex, isSensitiveField, parseSelectors } from "./shared";
import {
	type SiteConfig,
	type SiteConfigMap,
	getCustomSelectors,
	getDefaultFilterEnabled,
	getIsHidden,
	getSiteConfigs,
} from "./utils";

const dataTypeAttribute = "data-hide-sensitive-information-type";
const textOriginalAttribute = "data-hide-sensitive-original";
const styleOriginalAttribute = "data-hide-sensitive-original-style";

let isHiddenGlobal = false;
let defaultFilterEnabled = true;
let throttleTimer: ReturnType<typeof setTimeout> | null = null;
let customSelectors: string[] = [];
let siteConfigs: SiteConfigMap = {};
const pendingMutationRoots = new Set<Element>();

const normalizeHostnameKey = (hostname: string): string =>
	hostname.trim().toLowerCase().replace(/\.$/, "");

const normalizeSiteConfigMap = (configs: SiteConfigMap): SiteConfigMap => {
	const normalized: SiteConfigMap = {};
	for (const [hostname, config] of Object.entries(configs)) {
		const normalizedHost = normalizeHostnameKey(hostname);
		if (!normalizedHost) continue;
		normalized[normalizedHost] = config;
	}
	return normalized;
};

const getCurrentHostname = (): string => {
	try {
		return normalizeHostnameKey(window.location.hostname);
	} catch {
		return "";
	}
};

const getSiteConfig = (): SiteConfig | undefined => {
	const hostname = getCurrentHostname();
	return hostname ? siteConfigs[hostname] : undefined;
};

const useDefaultFilterForCurrentSite = (): boolean => {
	const siteConfig = getSiteConfig();
	return siteConfig?.defaultFilterEnabled ?? defaultFilterEnabled;
};

const refreshCustomSelectors = async () => {
	try {
		const raw = await getCustomSelectors();
		customSelectors = parseSelectors(raw);
		if (isHiddenGlobal) {
			requestAnimationFrame(() => {
				applyCustomSelectors();
			});
		}
	} catch (error) {
		console.log("Error loading custom selectors:", error);
		customSelectors = [];
	}
};

const refreshSiteConfigs = async () => {
	try {
		siteConfigs = normalizeSiteConfigMap(await getSiteConfigs());
		if (isHiddenGlobal) {
			requestAnimationFrame(() => {
				applySiteSelectors();
			});
		}
	} catch (error) {
		console.log("Error loading site configs:", error);
		siteConfigs = {};
	}
};

// Run as soon as possible - even before DOM is fully loaded
executeEarly();

const dedupeRoots = (roots: Element[]): Element[] => {
	const unique: Element[] = [];

	for (const root of roots) {
		if (
			unique.some((candidate) => candidate === root || candidate.contains(root))
		) {
			continue;
		}

		for (let i = unique.length - 1; i >= 0; i--) {
			if (root.contains(unique[i])) {
				unique.splice(i, 1);
			}
		}

		unique.push(root);
	}

	return unique;
};

const flushMutationRoots = () => {
	const roots = dedupeRoots(Array.from(pendingMutationRoots));
	pendingMutationRoots.clear();

	if (!isHiddenGlobal || roots.length === 0) return;

	for (const root of roots) {
		applyMasking(root);
	}
};

const queueMutationProcessing = () => {
	if (throttleTimer) return;

	throttleTimer = setTimeout(() => {
		throttleTimer = null;
		flushMutationRoots();
	}, 16);
};

const addMutationRoot = (node: Node) => {
	if (node instanceof Element) {
		pendingMutationRoots.add(node);
		return;
	}

	if (node.parentElement) {
		pendingMutationRoots.add(node.parentElement);
	}
};

// Create a continuous observer to detect new content
const contentObserver = new MutationObserver((mutations) => {
	if (!isHiddenGlobal) return;

	for (const mutation of mutations) {
		if (mutation.type === "childList") {
			for (const addedNode of mutation.addedNodes) {
				addMutationRoot(addedNode);
			}

			if (mutation.target instanceof Element) {
				pendingMutationRoots.add(mutation.target);
			}

			continue;
		}

		if (mutation.type === "characterData") {
			addMutationRoot(mutation.target);
		}
	}

	if (pendingMutationRoots.size > 0) {
		queueMutationProcessing();
	}
});

// Execute as early as possible
function executeEarly() {
	refreshCustomSelectors();
	refreshSiteConfigs();
	setupInputListener();

	// Try to get the state immediately
	(async () => {
		const [isHidden, filterEnabled, configs] = await Promise.all([
			getIsHidden(),
			getDefaultFilterEnabled(),
			getSiteConfigs(),
		]);
		defaultFilterEnabled = filterEnabled;
		siteConfigs = normalizeSiteConfigMap(configs);
		handleState(isHidden);

		// Execute immediately if we can
		if (isHidden && document.body) {
			requestAnimationFrame(() => {
				toggleSensitive();
			});
		}
	})();

	// Add fastest possible listeners
	document.addEventListener("DOMContentLoaded", () => {
		(async () => {
			const [isHidden, filterEnabled, configs] = await Promise.all([
				getIsHidden(),
				getDefaultFilterEnabled(),
				getSiteConfigs(),
			]);
			defaultFilterEnabled = filterEnabled;
			siteConfigs = normalizeSiteConfigMap(configs);
			handleState(isHidden);
			if (isHidden) {
				requestAnimationFrame(() => {
					toggleSensitive();
				});
			}
		})();
	});
}

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== "sync") return;

	// Handle isHidden changes (backup to message-based updates)
	if (changes.isHidden !== undefined) {
		const newHidden = changes.isHidden.newValue === true;
		if (newHidden !== isHiddenGlobal) {
			handleState(newHidden);
		}
	}

	// Handle defaultFilterEnabled changes
	if (changes.defaultFilterEnabled !== undefined) {
		defaultFilterEnabled = changes.defaultFilterEnabled.newValue === true;
		if (isHiddenGlobal) {
			requestAnimationFrame(() => {
				toggleSensitive();
			});
		}
	}

	// Handle customSelectors changes
	if (changes.customSelectors) {
		customSelectors = parseSelectors(changes.customSelectors.newValue);
		if (isHiddenGlobal) {
			requestAnimationFrame(() => {
				applyCustomSelectors();
			});
		}
	}

	// Handle siteConfigs changes
	if (changes.siteConfigs) {
		siteConfigs = normalizeSiteConfigMap(changes.siteConfigs.newValue || {});
		if (isHiddenGlobal) {
			requestAnimationFrame(() => {
				toggleSensitive();
			});
		}
	}
});

// Initial check directly
(async () => {
	const isHidden = await getIsHidden();
	handleState(isHidden);

	// Set up observers immediately
	if (document.body) {
		setupContinuousObservation();
	} else {
		// If body isn't ready, wait for it
		const checkBodyInterval = setInterval(() => {
			if (document.body) {
				clearInterval(checkBodyInterval);
				setupContinuousObservation();
			}
		}, 20);
	}

	// Also run when the page is fully loaded for any missed content
	window.addEventListener("load", () => {
		if (isHiddenGlobal) {
			requestAnimationFrame(() => {
				toggleSensitive();
			});
		}
	});
})();

// Set up monitoring for URL/navigation changes
function setupNavigationMonitoring() {
	// Listen for popstate events (back/forward navigation)
	window.addEventListener("popstate", () => {
		if (isHiddenGlobal) {
			requestAnimationFrame(() => {
				toggleSensitive();
			});
		}
	});

	// Monitor pushState and replaceState calls
	const originalPushState = history.pushState;
	const originalReplaceState = history.replaceState;

	history.pushState = (...args: Parameters<typeof history.pushState>) => {
		Reflect.apply(originalPushState, history, args);
		if (isHiddenGlobal) {
			requestAnimationFrame(() => {
				toggleSensitive();
			});
		}
	};

	history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
		Reflect.apply(originalReplaceState, history, args);
		if (isHiddenGlobal) {
			requestAnimationFrame(() => {
				toggleSensitive();
			});
		}
	};
}

// Set up continuous observation of DOM changes
function setupContinuousObservation() {
	// Start observing for dynamic content changes
	contentObserver.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true,
	});

	// Set up navigation monitoring for SPA
	setupNavigationMonitoring();
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request) => {
	if (request.action === "change-hidden-mode") {
		handleState(request.isHidden);
	}
});

function handleState(hidden: boolean) {
	isHiddenGlobal = hidden;
	if (document.body) {
		requestAnimationFrame(() => {
			if (hidden) toggleSensitive();
			else restoreSensitive();
		});
	}
}

function restoreSensitive(): void {
	try {
		restoreInputTypes();
		restoreMaskedStyles(document.body);
		restoreTextNodes(document.body);
	} catch (error) {
		console.log("Error restoring sensitive content:", error);
	}
}

function restoreInputTypes() {
	const inputs = Array.from(
		document.querySelectorAll<HTMLInputElement>(`input[${dataTypeAttribute}]`),
	);

	for (const input of inputs) {
		const original = input.getAttribute(dataTypeAttribute);
		if (original) {
			try {
				input.type = original;
			} catch {
				// ignore if type cannot be set
			}
		}
		input.removeAttribute(dataTypeAttribute);
	}
}

function restoreMaskedStyles(root: Element | Document | null) {
	if (!root) return;

	const elements = root.querySelectorAll(`[${styleOriginalAttribute}]`);

	for (const element of elements) {
		try {
			const encoded = element.getAttribute(styleOriginalAttribute);
			if (!encoded) continue;
			const original = JSON.parse(encoded) as {
				color?: string;
				textShadow?: string;
				caretColor?: string;
				webkitTextSecurity?: string;
				textSecurity?: string;
			};
			const htmlEl = element as HTMLElement;
			htmlEl.style.color = original.color ?? "";
			htmlEl.style.textShadow = original.textShadow ?? "";
			htmlEl.style.caretColor = original.caretColor ?? "";

			if (original.webkitTextSecurity) {
				htmlEl.style.setProperty(
					"-webkit-text-security",
					original.webkitTextSecurity,
				);
			} else {
				htmlEl.style.removeProperty("-webkit-text-security");
			}

			if (original.textSecurity) {
				htmlEl.style.setProperty("text-security", original.textSecurity);
			} else {
				htmlEl.style.removeProperty("text-security");
			}
		} catch {
			// ignore restore errors
		} finally {
			element.removeAttribute(styleOriginalAttribute);
		}
	}
}

function restoreTextNodes(root: Element | Document | null) {
	if (!root) return;

	const elements = root.querySelectorAll(`[${textOriginalAttribute}]`);

	for (const element of elements) {
		try {
			const encoded = element.getAttribute(textOriginalAttribute);
			if (encoded == null) continue;
			const original = decodeURIComponent(encoded);
			const textNode = document.createTextNode(original);
			element.replaceWith(textNode);
		} catch {
			// ignore errors during replace
		}
	}
}

function setupInputListener() {
	document.addEventListener("input", (event) => {
		if (!isHiddenGlobal || !useDefaultFilterForCurrentSite()) return;

		const target = event.target;

		if (target instanceof HTMLInputElement) {
			if (shouldMaskInput(target)) {
				maskElement(target);
			}
			return;
		}

		if (target instanceof HTMLTextAreaElement) {
			if (isSensitiveField(target) || emailRegex.test(target.value)) {
				maskElement(target);
			}
			return;
		}

		if (target instanceof HTMLElement && target.isContentEditable) {
			if (isSensitiveField(target)) {
				maskElement(target);
			}
		}
	});
}

function shouldMaskInput(input: HTMLInputElement) {
	// Skip hidden inputs - they're not visible to the user
	if (input.type === "hidden") return false;
	if (isSensitiveField(input)) return true;
	return input.value ? emailRegex.test(input.value) : false;
}

function applyStyleMask(element: HTMLElement) {
	if (element.hasAttribute(styleOriginalAttribute)) return;
	const original = {
		color: element.style.color,
		textShadow: element.style.textShadow,
		caretColor: element.style.caretColor,
		webkitTextSecurity: element.style.getPropertyValue("-webkit-text-security"),
		textSecurity: element.style.getPropertyValue("text-security"),
	};
	element.setAttribute(styleOriginalAttribute, JSON.stringify(original));
	element.style.setProperty("-webkit-text-security", "disc");
	element.style.setProperty("text-security", "disc");
	element.style.color = "transparent";
	element.style.textShadow = "0 0 8px rgba(0,0,0,0.6)";
	element.style.caretColor = "#94a3b8";
}

function maskElement(element: Element) {
	if (element instanceof HTMLInputElement) {
		maskInputElement(element);
		return;
	}
	if (element instanceof HTMLTextAreaElement) {
		applyStyleMask(element);
		return;
	}
	if (element instanceof HTMLElement) {
		applyStyleMask(element);
	}
}

function maskInputElement(input: HTMLInputElement) {
	if (input.type === "password") return;
	if (input.hasAttribute(dataTypeAttribute)) return;
	try {
		input.setAttribute(dataTypeAttribute, input.type);
		input.type = "password";
	} catch {
		applyStyleMask(input);
	}
}

const forEachMatchingElement = (
	root: Element | Document,
	selector: string,
	callback: (element: Element) => void,
) => {
	if (root instanceof Element && root.matches(selector)) {
		callback(root);
	}

	for (const element of root.querySelectorAll(selector)) {
		callback(element);
	}
};

function applyCustomSelectors(root: Element | Document = document) {
	if (!customSelectors.length) return;

	for (const selector of customSelectors) {
		try {
			forEachMatchingElement(root, selector, maskElement);
		} catch {
			// ignore invalid selectors
		}
	}
}

function applySiteSelectors(root: Element | Document = document) {
	const siteConfig = getSiteConfig();
	if (!siteConfig?.selectors) return;

	const selectors = parseSelectors(siteConfig.selectors);
	for (const selector of selectors) {
		try {
			forEachMatchingElement(root, selector, maskElement);
		} catch {
			// ignore invalid selectors
		}
	}
}

function processSensitiveFields(root: Element | Document = document) {
	const fields: Array<HTMLInputElement | HTMLTextAreaElement | HTMLElement> =
		[];

	if (root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement) {
		fields.push(root);
	} else if (root instanceof HTMLElement && root.isContentEditable) {
		fields.push(root);
	}

	for (const field of root.querySelectorAll<
		HTMLInputElement | HTMLTextAreaElement | HTMLElement
	>('input, textarea, [contenteditable="true"]')) {
		fields.push(field);
	}

	for (const field of fields) {
		if (field instanceof HTMLInputElement) {
			if (shouldMaskInput(field)) {
				maskElement(field);
			}
			continue;
		}

		if (field instanceof HTMLTextAreaElement) {
			if (isSensitiveField(field) || emailRegex.test(field.value)) {
				maskElement(field);
			}
			continue;
		}

		if (field instanceof HTMLElement && field.isContentEditable) {
			if (isSensitiveField(field)) {
				maskElement(field);
			}
		}
	}
}

function applyMasking(root: Element | Document = document): void {
	if (useDefaultFilterForCurrentSite()) {
		processSensitiveFields(root);
		replaceEmailsInTextNodes(root, emailRegex);
	}

	applyCustomSelectors(root);
	applySiteSelectors(root);
}

function toggleSensitive(): void {
	applyMasking(document);
}

// Function to safely traverse DOM and replace emails in text nodes only
function replaceEmailsInTextNodes(
	element: Element | Document | null,
	regex: RegExp,
): void {
	if (!element) return;

	// If this is an Element, optionally skip SCRIPT/STYLE
	if (element instanceof Element) {
		const tag = element.tagName;
		if (tag === "SCRIPT" || tag === "STYLE") return;
	}

	const childNodes = element.childNodes;
	for (let i = 0; i < childNodes.length; i++) {
		const node = childNodes[i];
		if (!node) continue;

		if (node.nodeType === Node.TEXT_NODE) {
			const current = node.nodeValue;
			if (current && regex.test(current)) {
				// Create a document fragment and replace matches with span elements
				const frag = document.createDocumentFragment();
				let lastIndex = 0;
				const matcher = new RegExp(regex.source, "gi");
				let match = matcher.exec(current);
				while (match !== null) {
					const index = match.index;
					// text before match
					if (index > lastIndex) {
						frag.appendChild(
							document.createTextNode(current.slice(lastIndex, index)),
						);
					}

					const matchedText = match[0];
					const masked = matchedText
						.split("@")
						.map((part) => part.replace(/./g, "*"))
						.join("@");

					const span = document.createElement("span");
					span.setAttribute(
						textOriginalAttribute,
						encodeURIComponent(matchedText),
					);
					span.textContent = masked;
					frag.appendChild(span);

					lastIndex = index + matchedText.length;
					match = matcher.exec(current);
				}

				// remaining text
				if (lastIndex < current.length) {
					frag.appendChild(document.createTextNode(current.slice(lastIndex)));
				}

				try {
					node.parentNode?.replaceChild(frag, node);
				} catch {
					// ignore replacement errors
				}
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			replaceEmailsInTextNodes(node as Element, regex);
		}
	}
}
