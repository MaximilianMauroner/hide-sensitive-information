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

let hidden: boolean | null = null;
let defaultFilterEnabled = true;
let siteEntries: SiteEntry[] = [];
let saving = false;
let theme: ThemeMode = "light";

const setSaveStatus = (message: string) => {
	if (!saveStatus) return;
	saveStatus.textContent = message;
};

const applyTheme = (next: ThemeMode) => {
	theme = next;
	document.documentElement.setAttribute("data-theme", theme);
	if (themeToggle) {
		themeToggle.textContent = theme === "dark" ? "Dark" : "Light";
		themeToggle.setAttribute(
			"aria-pressed",
			theme === "dark" ? "true" : "false",
		);
	}
};

const renderVisibility = () => {
	if (!visibilityLabel || !toggleButton) return;
	const isLoading = hidden === null;
	const label = isLoading ? "Loading" : hidden ? "Hidden" : "Showing";
	visibilityLabel.textContent = label;
	visibilityLabel.classList.toggle("is-on", !!hidden);
	visibilityLabel.classList.toggle("is-off", hidden === false);

	toggleButton.textContent = isLoading
		? "Loading..."
		: hidden
			? "Show information"
			: "Hide information";

	toggleButton.disabled = isLoading;
	toggleButton.classList.toggle("is-off", !hidden && !isLoading);
};

const renderSiteEntries = () => {
	if (!siteList) return;
	siteList.innerHTML = "";

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

		const hostField = document.createElement("div");
		hostField.className = "field";

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
		hostLabel.textContent = "Hostname";
		hostField.appendChild(hostLabel);
		hostField.appendChild(hostInput);

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
		selectorsLabel.textContent = "Selectors";
		selectorField.appendChild(selectorsLabel);
		selectorField.appendChild(selectorsInput);

		// Default filter dropdown
		const filterRow = document.createElement("div");
		filterRow.className = "site-filter-row";

		const filterLabel = document.createElement("label");
		filterLabel.className = "site-filter-label";
		filterLabel.textContent = "Default filter:";

		const filterSelect = document.createElement("select");
		const filterSelectId = `site-filter-${index}`;
		filterSelect.id = filterSelectId;
		filterSelect.className = "site-filter-select";
		filterLabel.htmlFor = filterSelectId;

		const optionInherit = document.createElement("option");
		optionInherit.value = "inherit";
		optionInherit.textContent = "Use global setting";

		const optionEnable = document.createElement("option");
		optionEnable.value = "true";
		optionEnable.textContent = "Enable";

		const optionDisable = document.createElement("option");
		optionDisable.value = "false";
		optionDisable.textContent = "Disable";

		filterSelect.appendChild(optionInherit);
		filterSelect.appendChild(optionEnable);
		filterSelect.appendChild(optionDisable);

		// Set current value
		if (entry.defaultFilterEnabled === true) {
			filterSelect.value = "true";
		} else if (entry.defaultFilterEnabled === false) {
			filterSelect.value = "false";
		} else {
			filterSelect.value = "inherit";
		}

		filterSelect.addEventListener("change", () => {
			if (filterSelect.value === "true") {
				siteEntries[index].defaultFilterEnabled = true;
			} else if (filterSelect.value === "false") {
				siteEntries[index].defaultFilterEnabled = false;
			} else {
				siteEntries[index].defaultFilterEnabled = undefined;
			}
		});

		filterRow.appendChild(filterLabel);
		filterRow.appendChild(filterSelect);

		const removeButton = document.createElement("button");
		removeButton.type = "button";
		removeButton.className = "remove";
		removeButton.textContent = "Remove";
		removeButton.setAttribute(
			"aria-label",
			`Remove site rule for ${entry.host || "new site rule"}`,
		);
		removeButton.addEventListener("click", () => {
			siteEntries = siteEntries.filter((_, idx) => idx !== index);
			renderSiteEntries();
		});

		row.appendChild(hostField);
		row.appendChild(selectorField);
		row.appendChild(filterRow);
		row.appendChild(removeButton);
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
		] = await Promise.all([
			getCustomSelectors(),
			getIsHidden(),
			getSiteConfigs(),
			getTheme(),
			getDefaultFilterEnabled(),
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
		await setDefaultFilterEnabled(defaultFilterEnabled);
	});
}

hydrate();
