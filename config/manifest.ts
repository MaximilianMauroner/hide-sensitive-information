import baseManifest from "../public/manifest.json";

const extensionHomepage =
	"https://github.com/MaximilianMauroner/hide-sensitive-information";

const firefoxExtensionId = "{5afca5de-4f8f-4f2b-9ba5-4063d4a64f4b}";

type BaseManifest = typeof baseManifest;

type FirefoxManifest = BaseManifest & {
	background: {
		scripts: string[];
	};
	browser_specific_settings: {
		gecko: {
			id: string;
			strict_min_version: string;
			data_collection_permissions: {
				required: string[];
			};
		};
		gecko_android: {
			strict_min_version: string;
		};
	};
	homepage_url: string;
};

export const getChromeManifest = (): BaseManifest & { homepage_url: string } => ({
	...baseManifest,
	homepage_url: extensionHomepage,
});

export const getFirefoxManifest = (): FirefoxManifest => ({
	...getChromeManifest(),
	background: {
		scripts: [baseManifest.background.service_worker],
	},
	browser_specific_settings: {
		gecko: {
			id: firefoxExtensionId,
			strict_min_version: "140.0",
			data_collection_permissions: {
				required: ["none"],
			},
		},
		gecko_android: {
			strict_min_version: "142.0",
		},
	},
});
