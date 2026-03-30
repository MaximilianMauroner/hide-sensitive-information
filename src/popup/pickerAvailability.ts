export type PickerAvailability = {
	isAvailable: boolean;
	helpText: string;
	title: string;
};

export const getPickerAvailability = (
	hidden: boolean | null,
): PickerAvailability => {
	if (hidden === null) {
		return {
			isAvailable: false,
			helpText: "Loading masking state...",
			title: "Masking state is still loading",
		};
	}

	if (hidden === false) {
		return {
			isAvailable: false,
			helpText:
				"Enable masking first. The picker only works while masking is active.",
			title: "Enable masking to use the element picker",
		};
	}

	return {
		isAvailable: true,
		helpText: "Click any element on the page to mask it",
		title: "Pick an element to mask",
	};
};
