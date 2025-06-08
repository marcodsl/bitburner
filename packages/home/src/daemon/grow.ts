import {command, positional} from '@drizzle-team/brocli';

export const grow = command({
  name: 'grow',
  desc: 'Continuously grows a specified host',
  aliases: ['h'],
  options: {
    host: positional('host').desc('The host to grow').required(),
    delay: positional('delay')
      .desc('The delay between grow calls in milliseconds')
      .default('1000'),
  },
  transform: args => ({
    host: args.host as string,
    delay: parseInt(args.delay as string, 10),
  }),
  handler: async ({delay, host}) => {
    while (true) {
      await ns.sleep(delay);
      await ns.grow(host);

      if (delay < 0) {
        break;
      }
    }
  },
});
