import {command, positional} from '@drizzle-team/brocli';

export const weaken = command({
  name: 'weaken',
  desc: 'Continuously weakens a specified host',
  aliases: ['w'],
  options: {
    host: positional('host').desc('The host to weaken').required(),
    delay: positional('delay')
      .desc('The delay between weaken calls in milliseconds')
      .default('1000'),
  },
  transform: args => ({
    host: args.host as string,
    delay: parseInt(args.delay as string, 10),
  }),
  handler: async ({delay, host}) => {
    while (true) {
      await ns.sleep(delay);
      await ns.weaken(host);

      if (delay < 0) {
        break;
      }
    }
  },
});
