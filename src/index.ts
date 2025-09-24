const dataTypeAttribute = "data-hide-sensitive-information-type";
let isHiddenGlobal: boolean = false;
let throttleTimer: ReturnType<typeof setTimeout> | null = null;

// Run as soon as possible - even before DOM is fully loaded
executeEarly();

// Create an observer instance that will run only once for initial load
const initialObserver = new MutationObserver((_mutations) => {
  try {
    // Process immediately without disconnecting first for speed
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  } catch (error) {
    console.log("Error in mutation observer:", error);
  }
});

// Create a continuous observer to detect new content
const contentObserver = new MutationObserver((_mutations) => {
  if (!isHiddenGlobal) return; // Only process if hiding is enabled

  // Throttle processing to prevent performance issues
  if (!throttleTimer) {
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      toggleEmail(); // Process any new content
    }, 10);
  }
});

// Execute as early as possible
function executeEarly() {
  // Try to get the state immediately
  chrome.storage.sync.get("isHidden", (data) => {
    handleState(data.isHidden);

    // Execute immediately if we can
    if (data.isHidden && document.body) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  });

  // Add fastest possible listeners
  document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.sync.get("isHidden", (data) => {
      handleState(data.isHidden);
      if (data.isHidden) {
        requestAnimationFrame(() => {
          toggleEmail();
        });
      }
    });
  });
}

// Initial check directly
chrome.storage.sync.get("isHidden", (data) => {
  handleState(data.isHidden);

  // Set up observers immediately
  if (document.body) {
    // Start observing for both initial and continuous changes
    initialObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Start the continuous observer for dynamic content
    setupContinuousObservation();
  } else {
    // If body isn't ready, wait for it
    const checkBodyInterval = setInterval(() => {
      if (document.body) {
        clearInterval(checkBodyInterval);

        initialObserver.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        setupContinuousObservation();
      }
    }, 5);
  }

  // Also run when the page is fully loaded for any missed content
  window.addEventListener("load", () => {
    if (data.isHidden) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  });
});

// Set up monitoring for URL/navigation changes
function setupNavigationMonitoring() {
  // Listen for popstate events (back/forward navigation)
  window.addEventListener("popstate", () => {
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  });

  // Monitor pushState and replaceState calls
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState.apply(this, args as any);
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleEmail();
      });
    }
  };

  history.replaceState = function (
    ...args: Parameters<typeof history.replaceState>
  ) {
    originalReplaceState.apply(this, args as any);
    if (isHiddenGlobal) {
      requestAnimationFrame(() => {
        toggleEmail();
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "change-hidden-mode") {
    handleState(request.isHidden);
  }
});

function handleState(hidden: boolean) {
  isHiddenGlobal = hidden; // Store the state globally

  if (hidden && document.body) {
    requestAnimationFrame(() => {
      toggleEmail();
    });
  }
}

function toggleEmail(): void {
  // email regex: https://stackoverflow.com/questions/201323/how-can-i-validate-an-email-address-using-a-regular-expression
  const emailRegex = RegExp(
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g
  );

  // Process visible elements first - prioritize what the user sees
  processVisibleContent(emailRegex);

  // Then process everything else
  processAllContent(emailRegex);
}

// Process visible content first (in viewport)
function processVisibleContent(emailRegex: RegExp): void {
  // get email inputs by id, name and obviously type. this can include duplicates but we don't care
  const possibleEmailInputs = [
    ...document.querySelectorAll(`input[id="mail"]`),
    ...document.querySelectorAll(`input[id="email"]`),
    ...document.querySelectorAll(`input[id="mail_address"]`),
    ...document.querySelectorAll(`input[id="email_address"]`),
    ...document.querySelectorAll(`input[name="mail"]`),
    ...document.querySelectorAll(`input[name="email"]`),
    ...document.querySelectorAll(`input[name="mail_address"]`),
    ...document.querySelectorAll(`input[name="email_address"]`),
    ...document.querySelectorAll(`input[type="email"]`),
  ] as HTMLInputElement[];

  // Handle input fields immediately
  for (const email of possibleEmailInputs) {
    const value = email.value;
    if (emailRegex.test(value)) {
      // Only change the type if not already processed
      if (!email.hasAttribute(dataTypeAttribute)) {
        email.setAttribute(dataTypeAttribute, email.type);
        email.type = "password";
      }
    }
  }

  // Try to find elements in the current viewport first
  try {
    const viewportHeight = window.innerHeight;
    const viewportElements = [];

    // Get all elements in the viewport
    const allElements = document.body.getElementsByTagName("*");
    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i];
      if (!element) continue;
      const rect = element.getBoundingClientRect();

      // Check if element is in viewport
      if (rect.top < viewportHeight && rect.bottom >= 0) {
        viewportElements.push(element);
      }
    }

    // Process viewport elements first
    viewportElements.forEach((element) => {
      replaceEmailsInTextNodes(element, emailRegex);
    });
  } catch (e) {
    // Fall back to default processing if viewport detection fails
    replaceEmailsInTextNodes(document.body, emailRegex);
  }
}

// Process all content after visible content
function processAllContent(emailRegex: RegExp): void {
  replaceEmailsInTextNodes(document.body, emailRegex);
}

// Function to safely traverse DOM and replace emails in text nodes only
function replaceEmailsInTextNodes(
  element: Element | Document | null,
  emailRegex: RegExp
): void {
  if (!element) return;

  // If this is an Element, optionally skip SCRIPT/STYLE
  if (element instanceof Element) {
    const tag = element.tagName;
    if (tag === "SCRIPT" || tag === "STYLE") return;
  }

  const childNodes = (element as Element | Document).childNodes;
  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    if (!node) continue;

    if (node.nodeType === Node.TEXT_NODE) {
      const current = node.nodeValue;
      if (current && emailRegex.test(current)) {
        node.nodeValue = current.replace(emailRegex, (match) => {
          return match
            .split("@")
            .map((part) => part.replace(/./g, "*"))
            .join("@");
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      replaceEmailsInTextNodes(node as Element, emailRegex);
    }
  }
}
