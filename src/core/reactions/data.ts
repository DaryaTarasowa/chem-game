import type {ReactionRule} from '../chemistry/types';

export const reactionDB: ReactionRule[] = [
    {
        id: 'vinegar_soda',                  // acid + carbonate -> CO2 (foam)
        inputs: ['vinegar', 'baking_soda'],
        outcome: {
            products: ['salt_acetate', 'water'],
            gas: true,
            effectTags: ['bubbles', 'foam', 'liquid'],
            colorChange: '#ffffff',
            score: 100,
        },
        hint: 'Try mixing an acid with a carbonate.',
    },
    {
        id: 'flame_na',                      // sodium salt + flame -> yellow flame
        inputs: ['salt_na', 'flame'],
        conditions: { flame: true },
        outcome: {
            products: ['salt_na'],
            flame: 'na',
            effectTags: ['flame_na'],
            score: 120,
        },
        hint: 'Expose the sodium salt to a flame.',
    },
    {
        id: 'h2o2_catalytic_foam',           // H2O2 + MnO2 -> O2 (foam, exothermic)
        inputs: ['hydrogen_peroxide', 'catalyst_mn02'],
        outcome: {
            products: ['water', 'oxygen'],
            gas: true,
            exothermic: true,
            effectTags: ['foam', 'smoke', 'bubbles'],
            score: 200,
        },
        hint: 'A catalyst makes it go wild.',
    },
];
