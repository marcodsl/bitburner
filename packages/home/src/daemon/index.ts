import {run} from '@drizzle-team/brocli';
import type {NS} from '@ns';

import {setup} from '@/environment';

import {grow} from './grow';
import {hack} from './hack';
import {weaken} from './weaken';

export async function main(ns: NS) {
  const {filename} = setup(ns);

  ns.ui.openTail();

  await run([grow, hack, weaken], {
    name: filename,
    description: 'Universal daemon',
    version: '1.0.0',
    globals: {},
  });
}
