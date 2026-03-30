import { parseSelectors } from "../shared";
import {
	type SiteConfigMap,
	type ThemeMode,
	getCurrentTab,
	getCustomSelectors,
	getDefaultFilterEnabled,
	getIsHidden,
	getSiteConfigs,
	getTheme,
	setCustomSelectors,
	setDefaultFilterEnabled,
	setIsHidden,
	setSiteConfigs,
	setTheme,
} from "../utils";
import { getPickerAvailability } from "./pickerAvailability";

type SiteEntry = {
	host: string;
	selectors: string;
	defaultFilterEnabled?: boolean; // undefined = inherit global, true/false = override
};

const normalizeSelectors = (raw: string) => parseSelectors(raw).join(", ");

const normalizeHost = (raw: string) => {
	const trimmed = raw.trim();
	if (!trimmed) return "";

	const normalizeHostname = (host: string) =>
		host.trim().toLowerCase().replace(/\.$/, "");

	try {
		const withProtocol = trimmed.includes("://")
			? trimmed
			: `https://${trimmed}`;
		return normalizeHostname(new URL(withProtocol).hostname);
	} catch {
		return normalizeHostname(trimmed.replace(/:\d+$/, ""));
	}
};

const globalSelectorsInput = document.getElementById(
	"global-selectors",
) as HTMLTextAreaElement | null;
const visibilityLabel = document.getElementById(
	"visibility-label",
) as HTMLSpanElement | null;
const toggleButton = document.getElementById(
	"toggle-button",
) as HTMLButtonElement | null;
const heroCard = toggleButton?.closest(".card--hero") as HTMLElement | null;
const addSiteButton = document.getElementById(
	"add-site",
) as HTMLButtonElement | null;
const siteList = document.getElementById("site-list") as HTMLDivElement | null;
const saveButton = document.getElementById(
	"save-button",
) as HTMLButtonElement | null;
const saveStatus = document.getElementById(
	"save-status",
) as HTMLSpanElement | null;
const themeToggle = document.getElementById(
	"theme-toggle",
) as HTMLButtonElement | null;
const examplesToggle = document.getElementById(
	"examples-toggle",
) as HTMLButtonElement | null;
const examplesTooltip = document.getElementById(
	"examples-tooltip",
) as HTMLDivElement | null;
const examplesLabel = examplesToggle?.querySelector(
	".hint-label",
) as HTMLSpanElement | null;
const defaultFilterToggle = document.getElementById(
	"default-filter-toggle",
) as HTMLInputElement | null;
const pickElementButton = document.getElementById(
	"pick-element",
) as HTMLButtonElement | null;
const pickerCard = document.getElementById("picker-card") as HTMLElement | null;
const pickerHelp = document.getElementById(
	"picker-help",
) as HTMLParagraphElement | null;
const currentPageHost = document.getElementById(
	"current-page-host",
) as HTMLSpanElement | null;
const currentPageSummary = document.getElementById(
	"current-page-summary",
) as HTMLParagraphElement | null;

let hidden: boolean | null = null;
let defaultFilterEnabled = true;
let siteEntries: SiteEntry[] = [];
let saving = false;
let theme: ThemeMode = "light";
let currentHost = "";

const pickerGlobalKey = "__hideSensitiveInformationStartPicker";

const setSaveStatus = (message: string) => {
	if (!saveStatus) return;
	saveStatus.textContent = message;
};

const applyTheme = (next: ThemeMode) => {
	theme = next;
	document.documentElement.setAttribute("data-theme", theme);
	if (themeToggle) {
		themeToggle.setAttribute(
			"aria-pressed",
			theme === "dark" ? "true" : "false",
		);
		themeToggle.setAttribute(
			"aria-label",
			theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
		);
	}
};

const renderVisibility = () => {
	if (!visibilityLabel || !toggleButton) return;
	const isLoading = hidden === null;
	const label = isLoading ? "Loading" : hidden ? "Active" : "Off";
	visibilityLabel.textContent = label;
	visibilityLabel.classList.toggle("is-on", !!hidden);
	visibilityLabel.classList.toggle("is-off", hidden === false);

	toggleButton.setAttribute("aria-checked", hidden ? "true" : "false");
	toggleButton.disabled = isLoading;
	toggleButton.classList.toggle("is-on", !!hidden);
	toggleButton.classList.toggle("is-off", hidden === false);

	if (heroCard) {
		heroCard.classList.toggle("is-active", !!hidden);
		heroCard.classList.toggle("is-inactive", hidden === false);
	}

	renderPickerAvailability();
};

const renderPickerAvailability = () => {
	if (!pickElementButton || !pickerHelp) return;

	const availability = getPickerAvailability(hidden);

	pickElementButton.disabled = !availability.isAvailable;
	pickElementButton.setAttribute(
		"aria-disabled",
		(!availability.isAvailable).toString(),
	);

	if (pickerCard) {
		pickerCard.classList.toggle("is-disabled", !availability.isAvailable);
	}

	pickerHelp.textContent = availability.helpText;
	pickElementButton.title = availability.title;
};

const renderCurrentPageInfo = () => {
	if (!currentPageHost || !currentPageSummary) return;

	if (!currentHost) {
		currentPageHost.textContent = "No page detected";
		currentPageSummary.textContent = "Open a web page to see active rules.";
		return;
	}

	currentPageHost.textContent = currentHost;

	const matchingSite = siteEntries.find(
		(e) => normalizeHost(e.host) === currentHost,
	);
	const parts: string[] = [];

	// Determine auto-detect status for this page
	const siteFilterOverride = matchingSite?.defaultFilterEnabled;
	const autoDetectActive =
		siteFilterOverride !== undefined
			? siteFilterOverride
			: defaultFilterEnabled;

	if (autoDetectActive) {
		parts.push("auto-detect");
	}

	const globalSels = globalSelectorsInput?.value.trim();
	if (globalSels) {
		parts.push("global selectors");
	}

	if (matchingSite?.selectors) {
		parts.push("site-specific selectors");
	}

	if (parts.length === 0) {
		currentPageSummary.textContent = "No rules active for this site.";
	} else {
		currentPageSummary.textContent = `Active: ${parts.join(", ")}`;
	}
};

const renderSiteEntries = () => {
	if (!siteList) return;
	siteList.innerHTML = "";
	renderCurrentPageInfo();

	if (siteEntries.length === 0) {
		const empty = document.createElement("p");
		empty.className = "help";
		empty.textContent = "No per-site rules yet.";
		siteList.appendChild(empty);
		return;
	}

	siteEntries.forEach((entry, index) => {
		const row = document.createElement("div");
		row.className = "site-row";

		// Highlight if this row matches the current page
		const entryHost = normalizeHost(entry.host);
		if (currentHost && entryHost === currentHost) {
			row.classList.add("is-current");
		}

		// Header row with hostname + remove button
		const header = document.createElement("div");
		header.className = "site-row__header";

		const hostField = document.createElement("div");
		hostField.className = "field";
		hostField.style.flex = "1";

		const hostInput = document.createElement("input");
		const hostInputId = `site-host-${index}`;
		hostInput.id = hostInputId;
		hostInput.type = "text";
		hostInput.className = "input";
		hostInput.placeholder = "example.com";
		hostInput.value = entry.host;
		hostInput.autocomplete = "off";
		hostInput.addEventListener("input", (event) => {
			const target = event.target as HTMLInputElement;
			siteEntries[index].host = target.value;
		});

		const hostLabel = document.createElement("label");
		hostLabel.className = "site-field-label";
		hostLabel.htmlFor = hostInputId;
		hostLabel.textContent = "Site";
		hostField.appendChild(hostLabel);
		hostField.appendChild(hostInput);

		const removeButton = document.createElement("button");
		removeButton.type = "button";
		removeButton.className = "remove";
		removeButton.textContent = "\u00d7";
		removeButton.setAttribute(
			"aria-label",
			`Remove site rule for ${entry.host || "new site rule"}`,
		);
		removeButton.addEventListener("click", () => {
			siteEntries = siteEntries.filter((_, idx) => idx !== index);
			renderSiteEntries();
		});

		header.appendChild(hostField);
		header.appendChild(removeButton);

		// Selectors field
		const selectorField = document.createElement("div");
		selectorField.className = "field";

		const selectorsInput = document.createElement("input");
		const selectorsInputId = `site-selectors-${index}`;
		selectorsInput.id = selectorsInputId;
		selectorsInput.type = "text";
		selectorsInput.className = "input";
		selectorsInput.placeholder = ".billing-email, input[name='token']";
		selectorsInput.value = entry.selectors;
		selectorsInput.autocomplete = "off";
		selectorsInput.addEventListener("input", (event) => {
			const target = event.target as HTMLInputElement;
			siteEntries[index].selectors = target.value;
		});

		const selectorsLabel = document.createElement("label");
		selectorsLabel.className = "site-field-label";
		selectorsLabel.htmlFor = selectorsInputId;
		selectorsLabel.textContent = "Extra selectors";
		selectorField.appendChild(selectorsLabel);
		selectorField.appendChild(selectorsInput);

		// Segmented control for auto-detect override
		const segControl = document.createElement("div");
		segControl.className = "seg-control";

		const segLabel = document.createElement("span");
		segLabel.className = "seg-control__label";
		segLabel.textContent = "Auto-detect sensitive fields";

		const segGroup = document.createElement("div");
		segGroup.className = "seg-control__group";

		const options = [
			{ value: "inherit", label: "Same as global" },
			{ value: "true", label: "Always on" },
			{ value: "false", label: "Off for site" },
		];

		let currentValue = "inherit";
		if (entry.defaultFilterEnabled === true) currentValue = "true";
		else if (entry.defaultFilterEnabled === false) currentValue = "false";

		for (const opt of options) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "seg-control__btn";
			btn.textContent = opt.label;
			if (opt.value === currentValue) btn.classList.add("is-active");

			btn.addEventListener("click", () => {
				if (opt.value === "true") {
					siteEntries[index].defaultFilterEnabled = true;
				} else if (opt.value === "false") {
					siteEntries[index].defaultFilterEnabled = false;
				} else {
					siteEntries[index].defaultFilterEnabled = undefined;
				}
				// Re-render to update active states
				for (const child of segGroup.children) {
					child.classList.remove("is-active");
				}
				btn.classList.add("is-active");
				renderCurrentPageInfo();
			});

			segGroup.appendChild(btn);
		}

		segControl.appendChild(segLabel);
		segControl.appendChild(segGroup);

		row.appendChild(header);
		row.appendChild(selectorField);
		row.appendChild(segControl);
		siteList.appendChild(row);
	});
};

const hydrate = async () => {
	try {
		const [
			storedSelectors,
			storedHidden,
			storedSites,
			storedTheme,
			storedDefaultFilter,
			tab,
		] = await Promise.all([
			getCustomSelectors(),
			getIsHidden(),
			getSiteConfigs(),
			getTheme(),
			getDefaultFilterEnabled(),
			getCurrentTab(),
		]);

		if (globalSelectorsInput) {
			globalSelectorsInput.value = storedSelectors;
		}

		hidden = storedHidden;
		defaultFilterEnabled = storedDefaultFilter;
		siteEntries = Object.entries(storedSites).map(([host, config]) => ({
			host,
			selectors: config.selectors || "",
			defaultFilterEnabled: config.defaultFilterEnabled,
		}));

		// Capture current tab hostname
		try {
			if (tab?.url) {
				currentHost = normalizeHost(tab.url);
			}
		} catch {
			currentHost = "";
		}

		if (defaultFilterToggle) {
			defaultFilterToggle.checked = defaultFilterEnabled;
		}

		applyTheme(storedTheme);
		renderVisibility();
		renderSiteEntries();
	} catch (error) {
		console.log("Failed to load settings", error);
	}
};

const handleToggle = async () => {
	if (hidden === null) return;
	hidden = !hidden;
	renderVisibility();
	await setIsHidden(hidden);
};

const handleAddSite = async () => {
	const tab = await getCurrentTab();
	let host = "";

	try {
		if (tab?.url) {
			host = normalizeHost(tab.url);
		}
	} catch {
		host = "";
	}

	siteEntries = [...siteEntries, { host, selectors: "" }];
	renderSiteEntries();
};

const handleSave = async () => {
	if (saving) return;
	saving = true;
	setSaveStatus("Saving...");

	const normalizedGlobal = globalSelectorsInput
		? normalizeSelectors(globalSelectorsInput.value)
		: "";

	const siteMap = siteEntries.reduce<SiteConfigMap>((acc, entry) => {
		const host = normalizeHost(entry.host);
		if (!host) return acc;
		const normalizedSelectors = normalizeSelectors(entry.selectors);
		// Include entry if it has selectors OR a defaultFilterEnabled override
		if (!normalizedSelectors && entry.defaultFilterEnabled === undefined)
			return acc;
		acc[host] = {
			selectors: normalizedSelectors || undefined,
			defaultFilterEnabled: entry.defaultFilterEnabled,
		};
		return acc;
	}, {});

	try {
		await Promise.all([
			setCustomSelectors(normalizedGlobal),
			setSiteConfigs(siteMap),
		]);

		if (globalSelectorsInput) {
			globalSelectorsInput.value = normalizedGlobal;
		}

		siteEntries = Object.entries(siteMap).map(([host, config]) => ({
			host,
			selectors: config.selectors || "",
			defaultFilterEnabled: config.defaultFilterEnabled,
		}));
		renderSiteEntries();
		setSaveStatus("Saved");
	} catch (error) {
		console.log("Failed to save selectors", error);
		setSaveStatus("Could not save");
	} finally {
		saving = false;
	}
};

const handleThemeToggle = async () => {
	const next = theme === "dark" ? "light" : "dark";
	applyTheme(next);
	await setTheme(next);
};

const startPickerInTab = async (tabId: number) => {
	try {
		await chrome.tabs.sendMessage(tabId, {
			action: "start-element-picker",
		});
		return true;
	} catch {
		// fall through to script injection for tabs without the content script loaded
	}

	if (!chrome.scripting?.executeScript) {
		return false;
	}

	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			files: ["pickerRuntime.js"],
		});
		await chrome.scripting.executeScript({
			target: { tabId },
			func: (globalKey: string) => {
				const start = (
					globalThis as typeof globalThis & {
						[key: string]: unknown;
					}
				)[globalKey];
				if (typeof start === "function") {
					start();
				}
			},
			args: [pickerGlobalKey],
		});
		return true;
	} catch (error) {
		console.log("Failed to inject picker", error);
		return false;
	}
};

if (toggleButton) {
	toggleButton.addEventListener("click", handleToggle);
}

if (addSiteButton) {
	addSiteButton.addEventListener("click", handleAddSite);
}

if (saveButton) {
	saveButton.addEventListener("click", handleSave);
}

if (themeToggle) {
	themeToggle.addEventListener("click", handleThemeToggle);
}

if (examplesToggle && examplesTooltip) {
	examplesToggle.addEventListener("click", () => {
		const isOpen = examplesTooltip.classList.toggle("is-open");
		examplesToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
		if (examplesLabel) {
			examplesLabel.textContent = isOpen ? "Close" : "Help";
		}
	});
}

if (defaultFilterToggle) {
	defaultFilterToggle.addEventListener("change", async () => {
		defaultFilterEnabled = defaultFilterToggle.checked;
		renderCurrentPageInfo();
		await setDefaultFilterEnabled(defaultFilterEnabled);
	});
}

if (pickElementButton) {
	pickElementButton.addEventListener("click", async () => {
		if (hidden !== true) {
			setSaveStatus("Enable masking to use the element picker");
			return;
		}

		const tab = await getCurrentTab();
		if (!tab?.id) {
			setSaveStatus("Picker unavailable on this page");
			return;
		}
		const started = await startPickerInTab(tab.id);
		if (started) {
			window.close();
			return;
		}
		setSaveStatus("Picker unavailable on this page");
	});
}

hydrate();
