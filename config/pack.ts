import Bun, { $ } from 'bun';
import AdmZip from 'adm-zip';
import manifest from '../public/manifest.json';

import './cwd';

await $`bun run ./config/build.ts`;
await $`mkdir -p ./release`;

const packName = manifest.name.toLowerCase().replace(/[\s\W]+/g, '-');

const { version } = manifest;

const folderToCompress = './build';
const outputArchiveChrome = `./release/${packName}-v${version}-chrome.zip`;
const outputArchiveFirefox = `./release/${packName}-v${version}-firefox.zip`;

const createZip = (outputArchive: string) => {
  const zip = new AdmZip();
  zip.addLocalFolder(folderToCompress);
  zip.writeZip(outputArchive);
  console.log(`Folder compressed into ${outputArchive}`);
};

createZip(outputArchiveChrome);
createZip(outputArchiveFirefox);
