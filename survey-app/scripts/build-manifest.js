#!/usr/bin/env node
/*
  Build a manifest of .wav/.lab pairs for the static survey app.
  Usage: node scripts/build-manifest.js [dataFolder]
  Default dataFolder: data/alpha_data
*/

const fs = require('fs');
const path = require('path');

const dataFolderArg = process.argv[2];
const DATA_FOLDER = dataFolderArg || path.join('data', 'alpha_data');

function getAllFiles(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
}

function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').replace(/\r\n?/g, '\n').trim();
  } catch (_) {
    return '';
  }
}

function main() {
  const absFolder = path.resolve(DATA_FOLDER);
  const files = getAllFiles(absFolder);

  const wavs = new Set(files.filter(f => f.toLowerCase().endsWith('.wav')));
  const labs = new Set(files.filter(f => f.toLowerCase().endsWith('.lab')));

  const pairs = [];
  for (const wav of wavs) {
    const base = wav.replace(/\.wav$/i, '');
    const lab = `${base}.lab`;
    if (!labs.has(lab)) continue;

    const sentence = readTextSafe(path.join(absFolder, lab));
    pairs.push({
      filename: wav,
      audio: path.posix.join(DATA_FOLDER.replace(/\\/g, '/'), wav),
      label: path.posix.join(DATA_FOLDER.replace(/\\/g, '/'), lab),
      sentence,
    });
  }

  pairs.sort((a, b) => a.filename.localeCompare(b.filename));

  const manifest = { dataset: DATA_FOLDER, count: pairs.length, pairs };

  const outFile = path.join(absFolder, 'manifest.json');
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`Manifest written: ${outFile}`);
  console.log(`Pairs: ${pairs.length}`);
}

main();