import { beforeEach, describe, expect, test } from "bun:test";

import "./setup";
import { generateSelector, startPicker } from "../picker";
import { getSiteConfigs } from "../utils";

const resetTestStorage = () => {
	(
		globalThis as typeof globalThis & {
			__resetTestStorage: () => void;
		}
	).__resetTestStorage();
};

describe("Picker selector generation", () => {
	beforeEach(() => {
		resetTestStorage();
		window.location.href = "https://example.com/current";
		document.documentElement.innerHTML = "<head></head><body></body>";
	});

	test("prefers a unique id", () => {
		document.body.innerHTML = '<div id="billing-email"></div>';
		const element = document.getElementById("billing-email");
		expect(element).toBeTruthy();
		expect(generateSelector(element as Element)).toBe("#billing-email");
	});

	test("uses tag[name] when it is unique", () => {
		document.body.innerHTML = '<textarea name="internal-note"></textarea>';
		const element = document.querySelector("textarea");
		expect(generateSelector(element as Element)).toBe(
			'textarea[name="internal-note"]',
		);
	});

	test("uses input[type][name] when name alone is ambiguous", () => {
		document.body.innerHTML = `
			<input type="text" name="token" />
			<input type="password" name="token" />
		`;
		const element = document.querySelector('input[type="password"]');
		expect(generateSelector(element as Element)).toBe(
			'input[type="password"][name="token"]',
		);
	});

	test("uses meaningful classes before data attributes", () => {
		document.body.innerHTML = `
			<div class="tw-flex billing-email"></div>
			<div data-testid="billing-email-target"></div>
		`;
		const element = document.querySelector(".billing-email");
		expect(generateSelector(element as Element)).toBe("div.billing-email");
	});

	test("uses data-testid when classes are not useful", () => {
		document.body.innerHTML =
			'<div class="tw-flex js-x a1" data-testid="secret-token"></div>';
		const element = document.querySelector("[data-testid]");
		expect(generateSelector(element as Element)).toBe(
			'[data-testid="secret-token"]',
		);
	});

	test("uses aria-label before falling back to nth-of-type", () => {
		document.body.innerHTML = '<button aria-label="Delete API token"></button>';
		const element = document.querySelector("button");
		expect(generateSelector(element as Element)).toBe(
			'button[aria-label="Delete API token"]',
		);
	});

	test("falls back to an nth-of-type path", () => {
		document.body.innerHTML = `
			<section>
				<div></div>
				<div><span></span></div>
				<div><span></span><span id="targetless"></span></div>
			</section>
		`;
		const element = document.getElementById("targetless");
		element?.removeAttribute("id");
		expect(generateSelector(element as Element)).toContain(":nth-of-type(2)");
	});
});

describe("Picker lifecycle", () => {
	beforeEach(() => {
		resetTestStorage();
		window.location.href = "https://example.com/current";
		document.documentElement.innerHTML = "<head></head><body></body>";
	});

	test("activates picker mode and cleans up on escape", () => {
		document.body.innerHTML = '<button id="pick-me">Pick me</button>';
		startPicker();

		expect(
			document.documentElement.getAttribute("data-hsi-picker-active"),
		).toBe("true");
		expect(document.getElementById("hsi-picker-overlay")).toBeTruthy();
		expect(document.getElementById("hsi-picker-style")).toBeTruthy();

		document.dispatchEvent(
			new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);

		expect(
			document.documentElement.hasAttribute("data-hsi-picker-active"),
		).toBe(false);
		expect(document.getElementById("hsi-picker-overlay")).toBeNull();
		expect(document.getElementById("hsi-picker-panel")).toBeNull();
	});

	test("masks the picked element immediately after saving", async () => {
		document.body.innerHTML = '<textarea id="pick-me">abc123</textarea>';
		const target = document.getElementById(
			"pick-me",
		) as HTMLTextAreaElement | null;
		expect(target).toBeTruthy();
		if (!target) throw new Error("expected textarea target");

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: () => target,
		});

		target.getBoundingClientRect = () =>
			({
				top: 0,
				left: 0,
				width: 120,
				height: 24,
				right: 120,
				bottom: 24,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect;

		startPicker();

		document.dispatchEvent(
			new window.MouseEvent("mousemove", {
				bubbles: true,
				clientX: 10,
				clientY: 10,
			}),
		);
		document.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				button: 0,
				clientX: 10,
				clientY: 10,
			}),
		);

		const saveButton = document.querySelector(
			'[data-action="global"]',
		) as HTMLButtonElement | null;
		expect(saveButton).toBeTruthy();

		saveButton?.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				button: 0,
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(
			target?.getAttribute("data-hide-sensitive-original-style"),
		).toBeTruthy();
		expect(target?.style.color).toBe("transparent");
	});

	test("previews the generated selector and clears the preview", () => {
		document.body.innerHTML = '<textarea id="pick-me">abc123</textarea>';
		const target = document.getElementById(
			"pick-me",
		) as HTMLTextAreaElement | null;
		expect(target).toBeTruthy();
		if (!target) throw new Error("expected textarea target");

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: () => target,
		});

		target.getBoundingClientRect = () =>
			({
				top: 0,
				left: 0,
				width: 120,
				height: 24,
				right: 120,
				bottom: 24,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect;

		startPicker();
		document.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				button: 0,
				clientX: 10,
				clientY: 10,
			}),
		);

		const previewButton = document.querySelector(
			'[data-action="preview"]',
		) as HTMLButtonElement | null;
		expect(previewButton).toBeTruthy();

		previewButton?.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				button: 0,
			}),
		);

		expect(target?.style.color).toBe("transparent");
		expect(previewButton?.textContent).toBe("Clear preview");

		previewButton?.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				button: 0,
			}),
		);

		expect(target?.style.color).toBe("");
		expect(target?.hasAttribute("data-hide-sensitive-picker-preview")).toBe(
			false,
		);
	});

	test("keeps the previewed mask after saving", async () => {
		document.body.innerHTML = '<textarea id="pick-me">abc123</textarea>';
		const target = document.getElementById(
			"pick-me",
		) as HTMLTextAreaElement | null;
		expect(target).toBeTruthy();
		if (!target) throw new Error("expected textarea target");

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: () => target,
		});

		target.getBoundingClientRect = () =>
			({
				top: 0,
				left: 0,
				width: 120,
				height: 24,
				right: 120,
				bottom: 24,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect;

		startPicker();
		document.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				button: 0,
				clientX: 10,
				clientY: 10,
			}),
		);

		const previewButton = document.querySelector(
			'[data-action="preview"]',
		) as HTMLButtonElement | null;
		const saveButton = document.querySelector(
			'[data-action="global"]',
		) as HTMLButtonElement | null;
		expect(previewButton).toBeTruthy();
		expect(saveButton).toBeTruthy();

		previewButton?.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				button: 0,
			}),
		);
		saveButton?.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				button: 0,
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(
			target?.getAttribute("data-hide-sensitive-original-style"),
		).toBeTruthy();
		expect(target?.hasAttribute("data-hide-sensitive-picker-preview")).toBe(
			false,
		);
		expect(target?.style.color).toBe("transparent");
	});

	test("allows dragging the picker panel", () => {
		document.body.innerHTML = '<textarea id="pick-me">abc123</textarea>';
		const target = document.getElementById(
			"pick-me",
		) as HTMLTextAreaElement | null;
		expect(target).toBeTruthy();
		if (!target) throw new Error("expected textarea target");

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: () => target,
		});

		target.getBoundingClientRect = () =>
			({
				top: 0,
				left: 0,
				width: 120,
				height: 24,
				right: 120,
				bottom: 24,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect;

		startPicker();
		document.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				button: 0,
				clientX: 10,
				clientY: 10,
			}),
		);

		const panel = document.getElementById(
			"hsi-picker-panel",
		) as HTMLDivElement | null;
		const head = panel?.querySelector(
			".hsi-picker-head",
		) as HTMLDivElement | null;
		expect(panel).toBeTruthy();
		expect(head).toBeTruthy();
		if (!panel || !head) throw new Error("expected picker panel");

		panel.getBoundingClientRect = () =>
			({
				top: 200,
				left: 100,
				width: 300,
				height: 180,
				right: 400,
				bottom: 380,
				x: 100,
				y: 200,
				toJSON: () => ({}),
			}) as DOMRect;

		head.dispatchEvent(
			new window.MouseEvent("mousedown", {
				bubbles: true,
				button: 0,
				clientX: 130,
				clientY: 220,
			}),
		);
		document.dispatchEvent(
			new window.MouseEvent("mousemove", {
				bubbles: true,
				clientX: 200,
				clientY: 260,
			}),
		);

		expect(panel.getAttribute("data-dragged")).toBe("true");
		expect(panel.style.left).toBe("170px");
		expect(panel.style.top).toBe("240px");
		expect(
			document.documentElement.getAttribute("data-hsi-picker-dragging"),
		).toBe("true");

		document.dispatchEvent(
			new window.MouseEvent("mouseup", {
				bubbles: true,
				button: 0,
			}),
		);

		expect(
			document.documentElement.hasAttribute("data-hsi-picker-dragging"),
		).toBe(false);
	});

	test("renders the site save action with a separate hostname line", () => {
		document.body.innerHTML = '<textarea id="pick-me">abc123</textarea>';
		const target = document.getElementById(
			"pick-me",
		) as HTMLTextAreaElement | null;
		expect(target).toBeTruthy();
		if (!target) throw new Error("expected textarea target");

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: () => target,
		});

		target.getBoundingClientRect = () =>
			({
				top: 0,
				left: 0,
				width: 120,
				height: 24,
				right: 120,
				bottom: 24,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect;

		startPicker();
		document.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				button: 0,
				clientX: 10,
				clientY: 10,
			}),
		);

		const siteButton = document.querySelector(
			'[data-action="site"]',
		) as HTMLButtonElement | null;
		const siteMeta = siteButton?.querySelector(
			".hsi-picker-button-meta",
		) as HTMLSpanElement | null;
		expect(siteButton).toBeTruthy();
		expect(siteMeta?.textContent).toBe("example.com");
		expect(siteButton?.textContent).toContain("Save for site");
	});

	test("disables site saves on pages without a hostname", async () => {
		window.location.href = "file:///tmp/manual-test.html";
		document.body.innerHTML = '<textarea id="pick-me">abc123</textarea>';
		const target = document.getElementById(
			"pick-me",
		) as HTMLTextAreaElement | null;
		expect(target).toBeTruthy();
		if (!target) throw new Error("expected textarea target");

		Object.defineProperty(document, "elementFromPoint", {
			configurable: true,
			value: () => target,
		});

		target.getBoundingClientRect = () =>
			({
				top: 0,
				left: 0,
				width: 120,
				height: 24,
				right: 120,
				bottom: 24,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}) as DOMRect;

		startPicker();
		document.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				button: 0,
				clientX: 10,
				clientY: 10,
			}),
		);

		const siteButton = document.querySelector(
			'[data-action="site"]',
		) as HTMLButtonElement | null;
		const status = document.querySelector(
			".hsi-picker-status",
		) as HTMLParagraphElement | null;
		expect(siteButton?.disabled).toBe(true);
		expect(siteButton?.title).toContain("without a hostname");
		expect(status?.textContent).toContain("without a hostname");

		siteButton?.dispatchEvent(
			new window.MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				button: 0,
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(await getSiteConfigs()).toEqual({});
	});
});
