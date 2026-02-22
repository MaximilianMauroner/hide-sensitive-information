# Privacy Policy

Last updated: February 22, 2026

This Privacy Policy applies to the Chrome extension **Hide Sensitive Information**.

## What this extension does

Hide Sensitive Information masks sensitive text and form fields on webpages (for example passwords, email addresses, tokens, and payment-related fields) so private data is less likely to appear during browsing, screen sharing, or recording.

## Data handling summary

- We do **not** collect personal data for our own use.
- We do **not** sell data.
- We do **not** send webpage content to our servers.
- We do **not** use third-party analytics, ads, or tracking SDKs in the extension.

All masking logic runs locally in the user's browser.

## Information processed in the browser

To do its job, the extension reads webpage DOM content and form field metadata on pages where it is active. This includes text visible on the page and field attributes needed to detect sensitive inputs.

This processing is local and transient. It is used only to mask content in-place.

## Information stored

The extension stores settings in `chrome.storage.sync`:

- on/off state
- global custom selectors
- per-site masking rules
- per-site filter overrides
- theme preference

These settings are stored by Chrome and may sync across the user's signed-in Chrome profile. We do not receive this data.

## Permissions and why they are used

- `storage`: save extension settings listed above.
- `tabs`: apply setting changes to open tabs and read the active tab URL when creating per-site rules.
- host access (`*://*/*`): required to apply masking on sites the user visits.

## Data sharing

We do not share user data with third parties, except where disclosure is required by law.

## Data retention and deletion

Because settings are stored in Chrome storage, users can remove data by:

1. deleting per-site/global rules in the extension UI,
2. clearing extension storage in browser settings, or
3. uninstalling the extension.

## Children's privacy

This extension is not directed to children under 13.

## Changes to this policy

If this policy changes, the updated version will be published in this repository with a new "Last updated" date.

## Contact

For questions or privacy requests, open an issue at:

[https://github.com/MaximilianMauroner/hide-sensitive-information/issues](https://github.com/MaximilianMauroner/hide-sensitive-information/issues)
