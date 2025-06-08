import {Glob} from 'bun';

import url from 'url';
import path from 'path';
import fs from 'fs/promises';

const __dirname = path.dirname(url.fileURLToPath(new URL(import.meta.url)));

const SRC_DIR = path.join(__dirname, 'src');
const OUT_DIR = path.join(__dirname, 'out');

await fs.rmdir(OUT_DIR, {recursive: true});

const sourceGlob = new Glob(`${SRC_DIR}/**/*.ts`);
const sourceFiles = await Array.fromAsync(sourceGlob.scan());

const entrypoints = (
  await Promise.all(
    sourceFiles.map(async file => {
      const content = await Bun.file(file).text();

      if (!content.includes('export async function main(')) {
        return null;
      }

      return file;
    }),
  )
).filter(Boolean) as string[];

const build = await Bun.build({
  entrypoints,
  outdir: OUT_DIR,
  target: 'node',
  external: ['@ns'],
});

for (const output of build.outputs) {
  const {path: outputPath} = output;

  if (!outputPath.endsWith('index.js')) {
    continue;
  }

  const outputDir = path.dirname(outputPath);
  const moduleName = path.basename(outputDir);
  const newPath = path.join(OUT_DIR, `${moduleName}.js`);

  const contents = await Bun.file(outputPath).text();

  Bun.write(newPath, contents);
  Bun.file(outputPath).unlink();

  const isEmpty =
    (await fs.lstat(outputDir)).isDirectory() &&
    (await fs.readdir(outputDir)).length === 0;

  if (isEmpty) {
    await fs.rmdir(outputDir);
  }
}
