import Bun, { $, Glob } from "bun";
import { existsSync } from "node:fs";
import { cp, rm, writeFile } from "node:fs/promises";

import "./cwd";
import manifest from "../public/manifest.json";
import { getChromeManifest, getFirefoxManifest } from "./manifest";

const chromeOutdir = "./build";
const firefoxOutdir = "./build-firefox";

const {
  content_scripts,
  background: { service_worker },
} = manifest;

const scripts = content_scripts.flatMap((script) => script.js);

const resolveEntryPoints = (entrypoints: string[]) => {
  return entrypoints.map((entrypoint) => `./src/${entrypoint}`);
};

const publicFolder = "./public";

await rm(chromeOutdir, { recursive: true, force: true });
await rm(firefoxOutdir, { recursive: true, force: true });

const ext = {
  html: ".html",
  png: ".png",
  css: ".css",
};

await Bun.build({
  target: "browser",
  entrypoints: resolveEntryPoints([
    ...scripts,
    service_worker,
    "popup/index.ts",
  ]),
  outdir: chromeOutdir,
});

const glob = new Glob("**");

const mainCssFile = Bun.file(`${publicFolder}/main.css`);

if (!mainCssFile.exists()) throw new Error("main.css not found");

for await (const filename of glob.scan(publicFolder)) {
  if (filename.endsWith(".DS_Store")) continue;

  const file = Bun.file(`${publicFolder}/${filename}`);

  if (!file.exists()) throw new Error(`File ${filename} does not exist`);

  if (filename.endsWith(ext.png) || filename.endsWith(ext.css)) continue;

  if (filename === "manifest.json") {
    await writeFile(
      `${chromeOutdir}/manifest.json`,
      `${JSON.stringify(getChromeManifest(), null, 2)}\n`,
    );
    continue;
  }

  if (filename.endsWith(ext.html)) {
    const fileFolder = filename.replace(ext.html, "");

    // rename files to index.html since it's being copied into a folder that share its original name
    await $`cp ${file.name} ${chromeOutdir}/${fileFolder}/index.html`;
    // copy the css file into the folder
    await $`cp ${mainCssFile.name} ${chromeOutdir}/${fileFolder}/main.css`;
  } else {
    await $`cp ${file.name} ${chromeOutdir}`;
  }
}

const copyIfExists = async (folderName: string) => {
  const folderPath = `${publicFolder}/${folderName}`;
  if (existsSync(folderPath)) {
    await cp(folderPath, `${chromeOutdir}/${folderName}`, {
      force: true,
      recursive: true,
      filter: (source) => !source.endsWith(".DS_Store"),
    });
  }
};

await copyIfExists("icons");

await cp(chromeOutdir, firefoxOutdir, {
  force: true,
  recursive: true,
  filter: (source) => !source.endsWith(".DS_Store"),
});

await writeFile(
  `${firefoxOutdir}/manifest.json`,
  `${JSON.stringify(getFirefoxManifest(), null, 2)}\n`,
);
