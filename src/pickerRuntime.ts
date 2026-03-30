import { startPicker } from "./picker";

const globalPickerKey = "__hideSensitiveInformationStartPicker";

(
	globalThis as typeof globalThis & {
		[key: string]: unknown;
	}
)[globalPickerKey] = startPicker;
