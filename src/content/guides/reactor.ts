import type { GameGuide } from '../types'

export const guide: GameGuide = {
  slug: 'reactor',
  title: 'Reactor Guide: The Buy Order That Reaches Your First Reboot Twice as Fast',
  description:
    "Reactor's real costs, rates and reboot math, plus simulated runs: buying by payback hit the 1M Reboot unlock in 40 minutes; cheapest-first took 82.",
  updated: '2026-10-09',
  sections: [
    {
      heading: 'The numbers under the neon',
      paragraphs: [
        "Reactor has six modules, and each owned level adds a fixed amount of charge per second. The Capacitor costs 10 and makes 0.1/s. The Coil costs 100 and makes 1/s. The Cell costs 1,100 and makes 8/s, the Core 12,000 for 47/s, the Array 130,000 for 260/s, and the Singularity 1,400,000 for 1,400/s. Every purchase multiplies that module's next price by 1.15, rounded up. A tap starts at 1 charge.",
        "The figure that matters most is payback time: price divided by output. A fresh Capacitor and a fresh Coil both pay for themselves in 100 seconds. A fresh Cell takes 138 seconds, a Core 255, an Array 500 and a Singularity 1,000. Because of the 1.15 growth, payback roughly doubles every five levels you own. The fifth Coil after the first pays back in 202 seconds, and the tenth in 405. Every decision in the early game comes down to comparing those payback times.",
      ],
    },
    {
      heading: 'Cheapest-first versus best payback, simulated',
      paragraphs: [
        "We drove the game's real engine in 100-millisecond steps from a brand-new save until lifetime charge reached 1,000,000, the point where Reboot unlocks, and tried several buying rules. The usual idle-game advice is to buy whatever is cheapest the moment you can afford it. With a steady three taps per second, that took 1 hour 22 minutes. A different rule, which saves for whichever module currently has the shortest payback even when that means waiting, took 40 minutes 14 seconds. That is just under half the time.",
        "The gap holds when you stop tapping. If you tap only until the first Capacitor and then leave it alone, cheapest-first needs 1 hour 40 minutes and the payback rule 1 hour 2 minutes. Buying nothing but Capacitors, for comparison, took 30 hours 42 minutes even with constant tapping.",
        "You can see why in the final builds. Cheapest-first ended with 59 Capacitors, 43 Coils, 26 Cells and 9 Cores, producing 679.9/s. The payback rule ended with 16/16/14/9 of those plus 4 Arrays, producing 1,592.6/s. Cheapest-first keeps pouring charge into low tiers whose prices have grown far beyond what they return.",
      ],
      list: [
        'Payback rule, tapping 3/s: 40m 14s to the first Reboot unlock.',
        'Cheapest-first, tapping 3/s: 1h 22m.',
        'Payback rule, idle after the first buy: 1h 2m. Cheapest-first: 1h 40m.',
        'Tapping 6/s instead of 3/s saved under three minutes with the payback rule (37m 37s).',
      ],
    },
    {
      heading: 'Doing the payback rule by eye',
      paragraphs: [
        "You don't need a calculator. For each module, divide the price shown on its button by its per-second rate, and buy the one with the smallest result, even if it means waiting a little longer. One catch: the display rounds small rates down, so the Capacitor's 0.1/s shows as 0 on its button. Treat it as a tenth of a Coil. In practice this produces a steady pattern: keep the Capacitor and Coil roughly level, because their base payback is identical and they grow at the same rate; push Cells up alongside them; and pick up each new tier as soon as its first level is competitive. The first Array, at a 500-second payback, becomes the better deal once your Capacitors and Coils are past about level 12.",
        "Number keys 1 to 6 buy the matching module, which makes it easy to follow the plan without hunting for buttons. The prestige multiplier scales every module equally, so it never changes which one is the best buy.",
      ],
    },
    {
      heading: 'Tapping: worth it only at the very start',
      paragraphs: [
        "A tap gives your tap power multiplied by the prestige multiplier. On a fresh save that is 1 charge, so ten taps buy the first Capacitor. After that, taps fade into irrelevance quickly. In our runs, doubling the tap rate from 3 to 6 per second saved under three minutes out of forty under the payback rule. Not tapping at all after the first purchase cost about 22 minutes.",
        "Tapping is worth doing in the first few minutes, when a handful of taps equals many seconds of production, and close to pointless once you produce more per second than you can tap. Each Reboot adds 1 to tap power, which nudges this balance a little but doesn't change it.",
      ],
    },
    {
      heading: 'Offline earnings: spend before you leave',
      paragraphs: [
        "When you return, the game multiplies your production per second by the time you were away, capped at 8 hours, and adds the result in one go. The welcome-back summary appears only if you were gone longer than 30 seconds. While you are away nothing gets bought, so your rate stays exactly where you left it.",
        "That gives one firm rule: spend everything before you close the tab. Unspent charge earns nothing, and every module you buy earns for the full time you are gone. At the payback-rule build's 1,592.6/s, a full 8-hour absence works out to about 45.9 million charge. Since the cap is 8 hours, coming back roughly every 8 hours wastes nothing, and a longer absence is simply not counted beyond that.",
      ],
    },
    {
      heading: 'Reboot math: a linear boost, not a compounding one',
      paragraphs: [
        "Reboot unlocks when lifetime charge reaches 1,000,000. It sets your charge and every module back to zero, keeps your lifetime total, and adds 1 to your reboot count and 1 to your tap power. The production multiplier is 1 + 0.1 × reboots, so it grows in a straight line: ×1.1 after one, ×1.5 after five, ×2.0 after ten. It does not compound. Ten reboots give exactly double, not 1.1 to the tenth power.",
        "For a sense of scale, we ran the payback rule again straight after one Reboot. Earning a million in that run took 34 minutes 12 seconds, against 40 minutes 14 seconds for the first. The leaderboard score is your lifetime charge plus 1,000,000 for each reboot, capped at 100 million, so a reboot never lowers your standing.",
      ],
      list: [
        'Multiplier = 1 + 0.1 × reboots (linear).',
        'Each Reboot also adds +1 to tap power.',
        'Score = lifetime charge + 1,000,000 × reboots, capped at 100,000,000.',
      ],
    },
    {
      heading: 'A plan for your first hour',
      paragraphs: [
        "Tap ten times and buy a Capacitor. Keep tapping in short bursts until a few Coils are running, then stop tapping and switch to the payback rule. Keep the two cheapest tiers level, add Cells and Cores as their price-to-rate figure catches up, and grab the first Array once it is the best ratio on the board. Before any break, empty your charge into the best-ratio module.",
        "Played like that, the Reboot bar fills in well under an hour of active time in our simulation. Following the cheapest-first habit takes about twice as long to reach the same point.",
      ],
    },
  ],
}
