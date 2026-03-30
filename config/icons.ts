import Bun, { $ } from "bun";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";

import "./cwd";

const iconSizes = [16, 32, 48, 128] as const;

const iconSources = [
  {
    source: "./assets/hide-sensitive-info-icon.png",
    outputDir: "./public/icons",
  },
  {
    source: "./assets/hide-sensitive-info-on-icon.png",
    outputDir: "./public/icons/on_icon",
  },
  {
    source: "./assets/hide-sensitive-info-off-icon.png",
    outputDir: "./public/icons/off_icon",
  },
] as const;

const hasGeneratedIcons = () => {
  return iconSources.every(({ outputDir }) =>
    iconSizes.every((size) => existsSync(`${outputDir}/icon-${size}.png`)),
  );
};

type GenerateIconsOptions = {
  requireImageMagick?: boolean;
};

export const generateIcons = async (
  { requireImageMagick = false }: GenerateIconsOptions = {},
) => {
  if (!Bun.which("magick")) {
    if (requireImageMagick || !hasGeneratedIcons()) {
      throw new Error(
        "ImageMagick 'magick' is required to generate transparent icons.",
      );
    }

    console.warn(
      "Skipping icon generation because ImageMagick is unavailable; using committed icons.",
    );
    return false;
  }

  for (const { source, outputDir } of iconSources) {
    await mkdir(outputDir, { recursive: true });

    for (const size of iconSizes) {
      await $`magick ${source} -resize ${size}x${size} ${outputDir}/icon-${size}.png`.quiet();
    }
  }

  return true;
};

if (import.meta.main) {
  await generateIcons({ requireImageMagick: true });
}
