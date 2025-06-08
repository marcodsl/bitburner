import {command, positional} from '@drizzle-team/brocli';

export const hack = command({
  name: 'hack',
  desc: 'Continuously hacks a specified host',
  aliases: ['h'],
  options: {
    host: positional('host').desc('The host to hack').required(),
    delay: positional('delay')
      .desc('The delay between hack calls in milliseconds')
      .default('1000'),
  },
  transform: args => ({
    host: args.host as string,
    delay: parseInt(args.delay as string, 10),
  }),
  handler: async ({delay, host}) => {
    while (true) {
      await ns.sleep(delay);
      await ns.hack(host);

      if (delay < 0) {
        break;
      }
    }
  },
});
