import { getIsHidden, setActionStatusIcon, setIsHidden } from "./utils";

chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason !== "install") return;

	setIsHidden(false).catch((error) => {
		console.log("Failed to set initial hidden state", error);
	});
});

const syncBadge = async () => {
	try {
		const hidden = await getIsHidden();
		await setActionStatusIcon(hidden);
	} catch (error) {
		console.log("Failed to sync badge state", error);
	}
};

syncBadge();

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== "sync") return;
	if (!changes.isHidden) return;
	syncBadge();
});
