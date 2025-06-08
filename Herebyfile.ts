import url from 'node:url';
import path from 'node:path';

import {task} from 'hereby';
import {createRemoteApi} from './packages/remote-api/src/index.ts';
import {Glob} from 'bun';

const __filename = url.fileURLToPath(new URL(import.meta.url));
const __dirname = path.dirname(__filename);

const HOME_DIR = path.join(__dirname, 'packages', 'home');

const HOME_TYPES_DIR = path.join(HOME_DIR, 'types');
const HOME_OUT_DIR = path.join(HOME_DIR, 'out');

function memoize<T>(fn: () => T): () => T {
  let value: T;
  return () => {
    if (fn !== undefined) {
      value = fn();
      fn = undefined as any;
    }
    return value;
  };
}

export const installDefinitions = task({
  name: 'install-definitions',
  description: 'Installs the RemoteAPI TypeScript definitions',
  run: async () => {
    const api = await createRemoteApi();
    const definitions = await api.getDefinitionFile();

    const fileName = 'NetscriptDefinitions.d.ts';
    const filePath = path.join(HOME_TYPES_DIR, fileName);

    await Bun.write(filePath, definitions);
    await api.shutdown();
  },
});

export const pushFiles = task({
  name: 'push-files',
  description: 'Pushes files to the game',
  run: async () => {
    const api = await createRemoteApi();

    const glob = new Glob(`${HOME_OUT_DIR}/**/*.js`);
    const files = await Array.fromAsync(glob.scan());

    for (const fileName of files) {
      const relativePath = path.relative(HOME_OUT_DIR, fileName);

      await api.pushFile({
        filename: path.basename(fileName),
        content: await Bun.file(fileName).text(),
        server: 'home',
      });

      console.log(`Pushed: ${relativePath}`);
    }

    await api.shutdown();
  },
});

export const build = task({
  name: 'build',
  description: 'Builds the Home scripts',
  run: async () => {
    const script = path.join(HOME_DIR, 'build.ts');

    await Bun.$`bun run ${script}`;
  },
});

export default task({
  name: 'default',
  hiddenFromTaskList: true,
  run: () => Bun.$`bun hereby --tasks`,
});
