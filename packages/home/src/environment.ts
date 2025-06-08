import type {NS} from '@ns';

import {BRIGHT_RED, BRIGHT_WHITE, BRIGHT_YELLOW, RESET} from '@/utils/colors';

declare global {
  var ns: NS;
}

export function setup(ns: NS) {
  globalThis.ns = ns;

  const self = ns.self();
  const {filename, args} = self;

  const originalConsole = console;

  globalThis.console = {
    ...originalConsole,
    log: (...args: any[]) => ns.print(BRIGHT_WHITE, ...args, RESET),
    error: (...args: any[]) => ns.print(BRIGHT_RED, ...args, RESET),
    warn: (...args: any[]) => ns.print(BRIGHT_YELLOW, ...args, RESET),
    info: (...args: any[]) => ns.print(BRIGHT_WHITE, ...args, RESET),
  } as Console;

  globalThis.process = {
    ...(globalThis.process || {}),
    argv: [
      'run',
      filename,
      ...(args.length === 0 ? ['--help'] : args.map(arg => `${arg}`)),
    ],
    exit: (code: number) => {
      ns.tprint(`Process exited with code ${code}`);
      ns.exit();
    },
  };

  return self;
}
