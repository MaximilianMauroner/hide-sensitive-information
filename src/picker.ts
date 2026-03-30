import { parseSelectors } from "./shared";
import {
	type SiteConfigMap,
	getCustomSelectors,
	getSiteConfigs,
	setCustomSelectors,
	setSiteConfigs,
} from "./utils";

const OVERLAY_ID = "hsi-picker-overlay";
const PANEL_ID = "hsi-picker-panel";
const STYLE_ID = "hsi-picker-style";
const dataTypeAttribute = "data-hide-sensitive-information-type";
const styleOriginalAttribute = "data-hide-sensitive-original-style";
const previewMarkerAttribute = "data-hide-sensitive-picker-preview";
const previewOriginalTypeAttribute =
	"data-hide-sensitive-picker-preview-original-type";
const previewOriginalStyleAttribute =
	"data-hide-sensitive-picker-preview-original-style";
const dragMargin = 12;

let active = false;
let overlay: HTMLDivElement | null = null;
let panel: HTMLDivElement | null = null;
let hoveredElement: Element | null = null;
let previewSelector: string | null = null;
let dragState: {
	offsetX: number;
	offsetY: number;
	width: number;
	height: number;
} | null = null;

const normalizeHostnameKey = (hostname: string): string =>
	hostname.trim().toLowerCase().replace(/\.$/, "");

const escapeCssIdentifier = (value: string) => {
	if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
		return CSS.escape(value);
	}

	return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
};

const escapeAttributeValue = (value: string) =>
	value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const isUniqueSelector = (selector: string) => {
	try {
		return document.querySelectorAll(selector).length === 1;
	} catch {
		return false;
	}
};

const isMeaningfulClass = (className: string) => {
	const trimmed = className.trim();
	if (trimmed.length < 3) return false;
	if (/^\d+$/.test(trimmed)) return false;
	if (/^(js|css|sc|tw|sm|md|lg|xl|2xl)-/i.test(trimmed)) return false;
	if (/^(hover|focus|active|group|peer):/i.test(trimmed)) return false;
	if (/^[A-Za-z0-9_-]{12,}$/.test(trimmed) && /\d/.test(trimmed)) return false;
	return true;
};

const buildNthOfTypePath = (element: Element) => {
	const segments: string[] = [];
	let current: Element | null = element;

	while (
		current &&
		current !== document.body &&
		current !== document.documentElement
	) {
		const parent = current.parentElement;
		if (!parent) break;

		const tag = current.tagName.toLowerCase();
		const siblings = Array.from(parent.children).filter(
			(sibling) => sibling.tagName === current?.tagName,
		);
		const index = siblings.indexOf(current) + 1;
		const segment =
			siblings.length === 1 ? tag : `${tag}:nth-of-type(${index})`;
		segments.unshift(segment);

		const selector = segments.join(" > ");
		if (isUniqueSelector(selector)) {
			return selector;
		}

		current = parent;
	}

	return segments.join(" > ") || element.tagName.toLowerCase();
};

export const generateSelector = (element: Element): string => {
	if (element.id) {
		const idSelector = `#${escapeCssIdentifier(element.id)}`;
		if (isUniqueSelector(idSelector)) return idSelector;
	}

	const tag = element.tagName.toLowerCase();
	const name = element.getAttribute("name");
	if (name) {
		const nameSelector = `${tag}[name="${escapeAttributeValue(name)}"]`;
		if (isUniqueSelector(nameSelector)) return nameSelector;
	}

	if (element instanceof HTMLInputElement && element.type && name) {
		const inputSelector = `input[type="${escapeAttributeValue(element.type)}"][name="${escapeAttributeValue(name)}"]`;
		if (isUniqueSelector(inputSelector)) return inputSelector;
	}

	const meaningfulClasses = Array.from(element.classList).filter(
		isMeaningfulClass,
	);
	for (let i = 1; i <= Math.min(meaningfulClasses.length, 3); i++) {
		const classSelector = `${tag}${meaningfulClasses
			.slice(0, i)
			.map((className) => `.${escapeCssIdentifier(className)}`)
			.join("")}`;
		if (isUniqueSelector(classSelector)) return classSelector;
	}

	const testId = element.getAttribute("data-testid");
	if (testId) {
		const testIdSelector = `[data-testid="${escapeAttributeValue(testId)}"]`;
		if (isUniqueSelector(testIdSelector)) return testIdSelector;
	}

	const ariaLabel = element.getAttribute("aria-label");
	if (ariaLabel) {
		const ariaSelector = `${tag}[aria-label="${escapeAttributeValue(ariaLabel)}"]`;
		if (isUniqueSelector(ariaSelector)) return ariaSelector;
	}

	return buildNthOfTypePath(element);
};

const ensurePickerStyles = () => {
	if (document.getElementById(STYLE_ID)) return;

	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
		html[data-hsi-picker-active="true"],
		html[data-hsi-picker-active="true"] * {
			cursor: crosshair !important;
		}

		html[data-hsi-picker-dragging="true"],
		html[data-hsi-picker-dragging="true"] * {
			cursor: grabbing !important;
			user-select: none !important;
		}

		#${OVERLAY_ID} {
			position: fixed;
			pointer-events: none;
			z-index: 2147483646;
			border: 2px solid #ef4444;
			border-radius: 12px;
			background: rgba(239, 68, 68, 0.14);
			box-shadow:
				0 0 0 1px rgba(248, 113, 113, 0.28),
				0 14px 36px rgba(15, 23, 42, 0.36);
			transition:
				transform 80ms ease,
				width 80ms ease,
				height 80ms ease,
				top 80ms ease,
				left 80ms ease,
				opacity 80ms ease;
			opacity: 0;
			transform: translateZ(0);
		}

		#${PANEL_ID} {
			position: fixed;
			left: 50%;
			bottom: 20px;
			transform: translate(-50%, 18px);
			width: min(460px, calc(100vw - 24px));
			z-index: 2147483647;
			padding: 16px;
			border-radius: 18px;
			border: 1px solid rgba(71, 85, 105, 0.6);
			background:
				linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(2, 6, 23, 0.96) 100%);
			color: #f8fafc;
			font-family:
				"JetBrains Mono",
				"IBM Plex Mono",
				"SF Mono",
				"Fira Code",
				"Cascadia Code",
				monospace;
			box-shadow: 0 30px 80px rgba(2, 6, 23, 0.58);
			opacity: 0;
			transition:
				opacity 160ms ease,
				transform 160ms ease;
		}

		#${PANEL_ID}[data-visible="true"] {
			opacity: 1;
			transform: translate(-50%, 0);
		}

		#${PANEL_ID} .hsi-picker-head {
			display: flex;
			align-items: start;
			justify-content: space-between;
			gap: 12px;
			margin-bottom: 12px;
			cursor: grab;
		}

		#${PANEL_ID} .hsi-picker-kicker {
			margin: 0 0 5px;
			font-size: 10px;
			font-weight: 700;
			letter-spacing: 0.18em;
			text-transform: uppercase;
			color: #94a3b8;
		}

		#${PANEL_ID} .hsi-picker-title {
			margin: 0;
			font-size: 14px;
			line-height: 1.35;
			color: #f8fafc;
		}

		#${PANEL_ID} .hsi-picker-close {
			border: 0;
			background: transparent;
			color: #94a3b8;
			font: inherit;
			font-size: 18px;
			line-height: 1;
			cursor: pointer;
		}

		#${PANEL_ID} .hsi-picker-code {
			margin: 0 0 14px;
			padding: 12px;
			border-radius: 12px;
			border: 1px solid rgba(51, 65, 85, 0.9);
			background: rgba(15, 23, 42, 0.78);
			font-size: 11px;
			line-height: 1.5;
			color: #e2e8f0;
			word-break: break-word;
			white-space: pre-wrap;
		}

		#${PANEL_ID} .hsi-picker-status {
			margin: 0 0 14px;
			font-size: 10px;
			line-height: 1.5;
			color: #94a3b8;
		}

		#${PANEL_ID} .hsi-picker-actions {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}

		#${PANEL_ID} .hsi-picker-button {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border-radius: 12px;
			padding: 11px 12px;
			border: 1px solid rgba(71, 85, 105, 0.72);
			background: rgba(30, 41, 59, 0.95);
			color: #f8fafc;
			font: inherit;
			font-size: 11px;
			font-weight: 700;
			cursor: pointer;
		}

		#${PANEL_ID} .hsi-picker-button--site {
			grid-column: 1 / -1;
			flex-direction: column;
			gap: 4px;
			min-width: 0;
		}

		#${PANEL_ID} .hsi-picker-button-meta {
			display: block;
			max-width: 100%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 10px;
			font-weight: 500;
			opacity: 0.9;
		}

		#${PANEL_ID} .hsi-picker-button:hover {
			border-color: rgba(148, 163, 184, 0.8);
		}

		#${PANEL_ID} .hsi-picker-button--accent {
			background: linear-gradient(180deg, #ef4444 0%, #b91c1c 100%);
			border-color: rgba(248, 113, 113, 0.75);
		}

		#${PANEL_ID} button:focus-visible {
			outline: 2px solid #93c5fd;
			outline-offset: 2px;
		}

		@media (max-width: 520px) {
			#${PANEL_ID} .hsi-picker-actions {
				grid-template-columns: 1fr;
			}
		}
	`;

	document.documentElement.appendChild(style);
};

const createOverlay = () => {
	const existing = document.getElementById(OVERLAY_ID);
	if (existing instanceof HTMLDivElement) return existing;

	const nextOverlay = document.createElement("div");
	nextOverlay.id = OVERLAY_ID;
	document.documentElement.appendChild(nextOverlay);
	return nextOverlay;
};

const saveGlobalSelector = async (selector: string) => {
	const selectors = parseSelectors(await getCustomSelectors());
	if (!selectors.includes(selector)) {
		selectors.push(selector);
		await setCustomSelectors(selectors.join(", "));
	}
};

const saveSiteSelector = async (selector: string, hostname: string) => {
	const configs: SiteConfigMap = await getSiteConfigs();
	const key = normalizeHostnameKey(hostname);
	if (!key) return false;
	const existing = configs[key];
	const currentSelectors = existing?.selectors
		? parseSelectors(existing.selectors)
		: [];

	if (!currentSelectors.includes(selector)) {
		currentSelectors.push(selector);
	}

	configs[key] = {
		...existing,
		selectors: currentSelectors.join(", "),
	};

	await setSiteConfigs(configs);
	return true;
};

const getInlineStyleSnapshot = (element: HTMLElement) => ({
	color: element.style.color,
	textShadow: element.style.textShadow,
	caretColor: element.style.caretColor,
	webkitTextSecurity: element.style.getPropertyValue("-webkit-text-security"),
	textSecurity: element.style.getPropertyValue("text-security"),
});

const applyInlineMaskStyles = (element: HTMLElement) => {
	element.style.setProperty("-webkit-text-security", "disc");
	element.style.setProperty("text-security", "disc");
	element.style.color = "transparent";
	element.style.textShadow = "0 0 8px rgba(0,0,0,0.6)";
	element.style.caretColor = "#94a3b8";
};

const applyStyleMask = (element: HTMLElement) => {
	if (element.hasAttribute(styleOriginalAttribute)) return;
	const original = {
		...getInlineStyleSnapshot(element),
	};
	element.setAttribute(styleOriginalAttribute, JSON.stringify(original));
	applyInlineMaskStyles(element);
};

const restoreInlineMaskStyles = (element: HTMLElement, encoded: string) => {
	const original = JSON.parse(encoded) as {
		color?: string;
		textShadow?: string;
		caretColor?: string;
		webkitTextSecurity?: string;
		textSecurity?: string;
	};
	element.style.color = original.color ?? "";
	element.style.textShadow = original.textShadow ?? "";
	element.style.caretColor = original.caretColor ?? "";

	if (original.webkitTextSecurity) {
		element.style.setProperty(
			"-webkit-text-security",
			original.webkitTextSecurity,
		);
	} else {
		element.style.removeProperty("-webkit-text-security");
	}

	if (original.textSecurity) {
		element.style.setProperty("text-security", original.textSecurity);
	} else {
		element.style.removeProperty("text-security");
	}
};

const previewMaskElement = (element: Element) => {
	if (element instanceof HTMLInputElement) {
		if (
			element.type === "password" ||
			element.hasAttribute(dataTypeAttribute) ||
			element.hasAttribute(previewOriginalTypeAttribute)
		) {
			return;
		}

		try {
			element.setAttribute(previewOriginalTypeAttribute, element.type);
			element.setAttribute(previewMarkerAttribute, "type");
			element.type = "password";
			return;
		} catch {
			// fall through to style masking
			element.removeAttribute(previewOriginalTypeAttribute);
		}
	}

	if (
		(element instanceof HTMLTextAreaElement ||
			element instanceof HTMLElement) &&
		!element.hasAttribute(styleOriginalAttribute) &&
		!element.hasAttribute(previewOriginalStyleAttribute)
	) {
		element.setAttribute(
			previewOriginalStyleAttribute,
			JSON.stringify(getInlineStyleSnapshot(element)),
		);
		element.setAttribute(previewMarkerAttribute, "style");
		applyInlineMaskStyles(element);
	}
};

const restorePreviewMask = (element: Element) => {
	const previewKind = element.getAttribute(previewMarkerAttribute);
	if (!previewKind) return;

	if (previewKind === "type" && element instanceof HTMLInputElement) {
		const originalType = element.getAttribute(previewOriginalTypeAttribute);
		if (originalType) {
			try {
				element.type = originalType;
			} catch {
				// ignore restore errors
			}
		}
		element.removeAttribute(previewOriginalTypeAttribute);
		element.removeAttribute(previewMarkerAttribute);
		return;
	}

	if (
		previewKind === "style" &&
		(element instanceof HTMLTextAreaElement || element instanceof HTMLElement)
	) {
		const encoded = element.getAttribute(previewOriginalStyleAttribute);
		if (encoded) {
			try {
				restoreInlineMaskStyles(element, encoded);
			} catch {
				// ignore restore errors
			}
		}
		element.removeAttribute(previewOriginalStyleAttribute);
		element.removeAttribute(previewMarkerAttribute);
	}
};

const clearPreview = () => {
	const previewed = Array.from(
		document.querySelectorAll(`[${previewMarkerAttribute}]`),
	);
	for (const element of previewed) {
		restorePreviewMask(element);
	}
	previewSelector = null;
};

const persistPreview = () => {
	const previewed = Array.from(
		document.querySelectorAll(`[${previewMarkerAttribute}]`),
	);

	for (const element of previewed) {
		const previewKind = element.getAttribute(previewMarkerAttribute);

		if (previewKind === "type" && element instanceof HTMLInputElement) {
			const originalType = element.getAttribute(previewOriginalTypeAttribute);
			if (originalType && !element.hasAttribute(dataTypeAttribute)) {
				element.setAttribute(dataTypeAttribute, originalType);
			}
			element.removeAttribute(previewOriginalTypeAttribute);
			element.removeAttribute(previewMarkerAttribute);
			continue;
		}

		if (
			previewKind === "style" &&
			(element instanceof HTMLTextAreaElement || element instanceof HTMLElement)
		) {
			const encoded = element.getAttribute(previewOriginalStyleAttribute);
			if (encoded && !element.hasAttribute(styleOriginalAttribute)) {
				element.setAttribute(styleOriginalAttribute, encoded);
			}
			element.removeAttribute(previewOriginalStyleAttribute);
			element.removeAttribute(previewMarkerAttribute);
		}
	}

	previewSelector = null;
};

const clampPanelPosition = (
	left: number,
	top: number,
	width: number,
	height: number,
) => {
	const viewportWidth =
		typeof window.innerWidth === "number" ? window.innerWidth : width;
	const viewportHeight =
		typeof window.innerHeight === "number" ? window.innerHeight : height;
	const maxLeft = Math.max(dragMargin, viewportWidth - width - dragMargin);
	const maxTop = Math.max(dragMargin, viewportHeight - height - dragMargin);

	return {
		left: Math.min(Math.max(dragMargin, left), maxLeft),
		top: Math.min(Math.max(dragMargin, top), maxTop),
	};
};

const movePanelTo = (left: number, top: number) => {
	if (!panel) return;

	const rect = panel.getBoundingClientRect();
	const width = dragState?.width || rect.width;
	const height = dragState?.height || rect.height;
	const nextPosition = clampPanelPosition(left, top, width, height);

	panel.setAttribute("data-dragged", "true");
	panel.style.left = `${nextPosition.left}px`;
	panel.style.top = `${nextPosition.top}px`;
	panel.style.bottom = "auto";
	panel.style.transform = "translate(0, 0)";
};

const stopPanelDrag = () => {
	dragState = null;
	document.documentElement.removeAttribute("data-hsi-picker-dragging");
	document.removeEventListener("mousemove", handlePanelDragMove, true);
	document.removeEventListener("mouseup", stopPanelDrag, true);
};

function handlePanelDragMove(event: MouseEvent) {
	if (!dragState) return;
	event.preventDefault();
	movePanelTo(
		event.clientX - dragState.offsetX,
		event.clientY - dragState.offsetY,
	);
}

const startPanelDrag = (event: MouseEvent) => {
	if (event.button !== 0 || !panel) return;
	if (event.target instanceof Element && event.target.closest("button")) return;

	const rect = panel.getBoundingClientRect();
	dragState = {
		offsetX: event.clientX - rect.left,
		offsetY: event.clientY - rect.top,
		width: rect.width,
		height: rect.height,
	};

	document.documentElement.setAttribute("data-hsi-picker-dragging", "true");
	document.addEventListener("mousemove", handlePanelDragMove, true);
	document.addEventListener("mouseup", stopPanelDrag, true);
	event.preventDefault();
};

const getMatchedElements = (selector: string) => {
	try {
		return Array.from(document.querySelectorAll(selector));
	} catch {
		return [];
	}
};

const maskElementImmediately = (element: Element) => {
	if (element instanceof HTMLInputElement) {
		if (element.type === "password") return;
		if (element.hasAttribute(dataTypeAttribute)) return;
		try {
			element.setAttribute(dataTypeAttribute, element.type);
			element.type = "password";
			return;
		} catch {
			applyStyleMask(element);
			return;
		}
	}

	if (
		element instanceof HTMLTextAreaElement ||
		element instanceof HTMLElement
	) {
		applyStyleMask(element);
	}
};

const cleanup = ({
	preservePreview = false,
}: { preservePreview?: boolean } = {}) => {
	active = false;
	hoveredElement = null;
	stopPanelDrag();
	if (preservePreview) {
		persistPreview();
	} else {
		clearPreview();
	}

	document.removeEventListener("mousemove", handleMouseMove, true);
	document.removeEventListener("click", handleClick, true);
	document.removeEventListener("keydown", handleKeyDown, true);

	document.documentElement.removeAttribute("data-hsi-picker-active");
	document.getElementById(OVERLAY_ID)?.remove();
	document.getElementById(PANEL_ID)?.remove();
	document.getElementById(STYLE_ID)?.remove();

	overlay = null;
	panel = null;
};

const openPanel = (target: Element, selector: string) => {
	document.getElementById(PANEL_ID)?.remove();

	const hostname = normalizeHostnameKey(window.location.hostname);
	const canSaveForSite = hostname.length > 0;
	const siteLabel = canSaveForSite ? hostname : "No hostname";
	const nextPanel = document.createElement("div");
	nextPanel.id = PANEL_ID;
	nextPanel.innerHTML = `
		<div class="hsi-picker-head">
			<div>
				<p class="hsi-picker-kicker">Element picked</p>
				<p class="hsi-picker-title">Save this selector for automatic masking.</p>
			</div>
			<button class="hsi-picker-close" type="button" aria-label="Cancel picker">&times;</button>
		</div>
		<pre class="hsi-picker-code"></pre>
		<p class="hsi-picker-status" aria-live="polite"></p>
		<div class="hsi-picker-actions">
			<button class="hsi-picker-button" type="button" data-action="preview">Preview</button>
			<button class="hsi-picker-button" type="button" data-action="global">Save globally</button>
			<button class="hsi-picker-button hsi-picker-button--accent hsi-picker-button--site" type="button" data-action="site" title="Save for ${siteLabel}">
				<span>Save for site</span>
				<span class="hsi-picker-button-meta">${siteLabel}</span>
			</button>
		</div>
	`;

	const code = nextPanel.querySelector(".hsi-picker-code");
	const status = nextPanel.querySelector(".hsi-picker-status");
	const previewButton = nextPanel.querySelector(
		'[data-action="preview"]',
	) as HTMLButtonElement | null;
	const siteButton = nextPanel.querySelector(
		'[data-action="site"]',
	) as HTMLButtonElement | null;
	if (code) {
		code.textContent = selector;
	}

	const setStatus = (message: string) => {
		if (status) {
			status.textContent = message;
		}
	};

	const syncPreviewButton = () => {
		if (!previewButton) return;
		const isActive = previewSelector === selector;
		previewButton.textContent = isActive ? "Clear preview" : "Preview";
		previewButton.setAttribute("aria-pressed", isActive ? "true" : "false");
	};

	syncPreviewButton();
	if (siteButton) {
		siteButton.disabled = !canSaveForSite;
		siteButton.setAttribute("aria-disabled", (!canSaveForSite).toString());
		siteButton.title = canSaveForSite
			? `Save for ${hostname}`
			: "Per-site saves are unavailable on pages without a hostname";
	}
	setStatus(
		canSaveForSite
			? "Preview the generated selector on this page before saving. Drag this panel if it covers the page."
			: "Preview the generated selector on this page before saving. Per-site saves are unavailable on pages without a hostname.",
	);

	nextPanel
		.querySelector(".hsi-picker-head")
		?.addEventListener("mousedown", startPanelDrag);

	nextPanel
		.querySelector(".hsi-picker-close")
		?.addEventListener("click", cleanup);

	nextPanel
		.querySelector('[data-action="preview"]')
		?.addEventListener("click", () => {
			if (previewSelector === selector) {
				clearPreview();
				syncPreviewButton();
				setStatus("Preview cleared.");
				return;
			}

			clearPreview();
			const matches = getMatchedElements(selector);
			for (const element of matches) {
				previewMaskElement(element);
			}
			previewSelector = selector;
			syncPreviewButton();
			const count = matches.length;
			setStatus(
				count === 1
					? "Preview active for 1 matching element."
					: `Preview active for ${count} matching elements.`,
			);
		});

	nextPanel
		.querySelector('[data-action="global"]')
		?.addEventListener("click", async () => {
			await saveGlobalSelector(selector);
			if (previewSelector === selector) {
				cleanup({ preservePreview: true });
				return;
			}
			maskElementImmediately(target);
			cleanup();
		});

	nextPanel
		.querySelector('[data-action="site"]')
		?.addEventListener("click", async () => {
			if (!canSaveForSite) {
				setStatus(
					"Per-site saves are unavailable on pages without a hostname.",
				);
				return;
			}

			const saved = await saveSiteSelector(selector, hostname);
			if (!saved) {
				setStatus(
					"Per-site saves are unavailable on pages without a hostname.",
				);
				return;
			}

			if (previewSelector === selector) {
				cleanup({ preservePreview: true });
				return;
			}
			maskElementImmediately(target);
			cleanup();
		});

	document.documentElement.appendChild(nextPanel);
	requestAnimationFrame(() => {
		nextPanel.setAttribute("data-visible", "true");
	});

	panel = nextPanel;
};

const getTargetElement = (event: MouseEvent) => {
	const pointed = document.elementFromPoint(event.clientX, event.clientY);
	if (!(pointed instanceof Element)) return null;
	if (pointed.id === OVERLAY_ID) return null;
	if (pointed.id === PANEL_ID || pointed.closest(`#${PANEL_ID}`)) return null;
	return pointed;
};

function handleMouseMove(event: MouseEvent) {
	if (!active || !overlay) return;

	const target = getTargetElement(event);
	if (!target) return;

	hoveredElement = target;
	const rect = target.getBoundingClientRect();

	overlay.style.opacity = "1";
	overlay.style.top = `${rect.top}px`;
	overlay.style.left = `${rect.left}px`;
	overlay.style.width = `${rect.width}px`;
	overlay.style.height = `${rect.height}px`;
}

function handleClick(event: MouseEvent) {
	if (!active || event.button !== 0) return;

	const target = getTargetElement(event);
	if (!target) return;

	event.preventDefault();
	event.stopPropagation();
	event.stopImmediatePropagation();

	hoveredElement = target;
	active = false;

	if (overlay) {
		overlay.style.opacity = "0";
	}

	openPanel(target, generateSelector(target));
}

function handleKeyDown(event: KeyboardEvent) {
	if (event.key !== "Escape") return;
	event.preventDefault();
	cleanup();
}

export const startPicker = () => {
	cleanup();

	active = true;
	ensurePickerStyles();
	overlay = createOverlay();
	document.documentElement.setAttribute("data-hsi-picker-active", "true");

	document.addEventListener("mousemove", handleMouseMove, true);
	document.addEventListener("click", handleClick, true);
	document.addEventListener("keydown", handleKeyDown, true);
};
