import {
  getCurrentTab,
  getCustomSelectors,
  getIsHidden,
  getSiteSelectors,
  getTheme,
  setCustomSelectors,
  setIsHidden,
  setSiteSelectors,
  setTheme,
  type SiteSelectorMap,
  type ThemeMode,
} from "../utils";

type SiteEntry = { host: string; selectors: string };

const normalizeSelectors = (raw: string) =>
  raw
    .split(/[\n,]+/)
    .map((selector) => selector.trim())
    .filter(Boolean)
    .join(", ");

const normalizeHost = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.includes("://")) {
      return new URL(trimmed).hostname;
    }
    if (trimmed.includes("/")) {
      return new URL(`https://${trimmed}`).hostname;
    }
  } catch (error) {
    return trimmed;
  }
  return trimmed;
};

const globalSelectorsInput = document.getElementById(
  "global-selectors"
) as HTMLTextAreaElement | null;
const visibilityLabel = document.getElementById(
  "visibility-label"
) as HTMLSpanElement | null;
const toggleButton = document.getElementById(
  "toggle-button"
) as HTMLButtonElement | null;
const addSiteButton = document.getElementById(
  "add-site"
) as HTMLButtonElement | null;
const siteList = document.getElementById("site-list") as HTMLDivElement | null;
const saveButton = document.getElementById(
  "save-button"
) as HTMLButtonElement | null;
const saveStatus = document.getElementById(
  "save-status"
) as HTMLSpanElement | null;
const themeToggle = document.getElementById(
  "theme-toggle"
) as HTMLButtonElement | null;
const examplesToggle = document.getElementById(
  "examples-toggle"
) as HTMLButtonElement | null;
const examplesTooltip = document.getElementById(
  "examples-tooltip"
) as HTMLDivElement | null;
const examplesLabel = examplesToggle?.querySelector(
  ".hint-label"
) as HTMLSpanElement | null;

let hidden: boolean | null = null;
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
    themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
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

    const hostInput = document.createElement("input");
    hostInput.type = "text";
    hostInput.className = "input";
    hostInput.placeholder = "example.com";
    hostInput.value = entry.host;
    hostInput.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      siteEntries[index].host = target.value;
    });

    const selectorsInput = document.createElement("input");
    selectorsInput.type = "text";
    selectorsInput.className = "input";
    selectorsInput.placeholder = ".billing-email, input[name='token']";
    selectorsInput.value = entry.selectors;
    selectorsInput.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      siteEntries[index].selectors = target.value;
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      siteEntries = siteEntries.filter((_, idx) => idx !== index);
      renderSiteEntries();
    });

    row.appendChild(hostInput);
    row.appendChild(selectorsInput);
    row.appendChild(removeButton);
    siteList.appendChild(row);
  });
};

const hydrate = async () => {
  try {
    const [storedSelectors, storedHidden, storedSites, storedTheme] =
      await Promise.all([
        getCustomSelectors(),
        getIsHidden(),
        getSiteSelectors(),
        getTheme(),
      ]);

    if (globalSelectorsInput) {
      globalSelectorsInput.value = storedSelectors;
    }

    hidden = storedHidden;
    siteEntries = Object.entries(storedSites).map(([host, selectors]) => ({
      host,
      selectors,
    }));

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
  const host = tab?.url ? new URL(tab.url).hostname : "";
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

  const siteMap = siteEntries.reduce<SiteSelectorMap>((acc, entry) => {
    const host = normalizeHost(entry.host);
    if (!host) return acc;
    const normalized = normalizeSelectors(entry.selectors);
    if (!normalized) return acc;
    acc[host] = normalized;
    return acc;
  }, {});

  try {
    await Promise.all([
      setCustomSelectors(normalizedGlobal),
      setSiteSelectors(siteMap),
    ]);

    if (globalSelectorsInput) {
      globalSelectorsInput.value = normalizedGlobal;
    }

    siteEntries = Object.entries(siteMap).map(([host, selectors]) => ({
      host,
      selectors,
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

hydrate();
