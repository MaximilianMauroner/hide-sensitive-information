import { describe, expect, test } from "bun:test";

import { getPickerAvailability } from "../popup/pickerAvailability";

describe("Popup picker availability", () => {
	test("disables the picker with guidance when masking is off", () => {
		const availability = getPickerAvailability(false);

		expect(availability.isAvailable).toBe(false);
		expect(availability.helpText).toContain("Enable masking first");
		expect(availability.title).toBe("Enable masking to use the element picker");
	});
});
