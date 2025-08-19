
import type {ReagentId, ReactionOutcome, ReactionRule} from '../chemistry/types';
import { reactionDB } from './data';

export type Temperature = 'room' | 'hot' | 'cold';

export interface ReactOpts {
    temperature?: Temperature;
    flame?: boolean;         // whether a flame is present (for flame tests)
}

/** Normalize inputs to a multiset key: counts matter, order doesn't. */
function normalize(inputs: ReagentId[]): string {
    const counts = new Map<ReagentId, number>();
    for (const id of inputs) counts.set(id, (counts.get(id) ?? 0) + 1);
    // stable key like "acid:2+baking_soda:1"
    return [...counts.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([id, n]) => `${id}:${n}`)
        .join('+');
}

/** Compare two input lists as multisets (order-agnostic, counts-aware). */
function sameInputs(a: ReagentId[], b: ReagentId[]): boolean {
    return normalize(a) === normalize(b);
}

/** Check if a rule's conditions match given options. */
function matchConditions(rule: ReactionRule, opts: ReactOpts): boolean {
    const c = rule.conditions;
    if (!c) return true;
    if (c.temperature && (opts.temperature ?? 'room') !== c.temperature) return false;
    if (typeof c.flame === 'boolean' && (opts.flame ?? false) !== c.flame) return false;
    // If a catalyst is required, it must be present among inputs: we check it elsewhere (in data rules include catalyst in inputs)
    return true;
}

/** Try to find a matching rule and return it. */
export function findRule(inputs: ReagentId[], opts: ReactOpts = {}): ReactionRule | null {
    for (const rule of reactionDB) {
        if (sameInputs(rule.inputs, inputs) && matchConditions(rule, opts)) {
            return rule;
        }
    }
    return null;
}

/** High-level API: inputs (+opts) -> ReactionOutcome | null. */
export function react(
    inputs: ReagentId[],
    opts: ReactOpts = {}
): ReactionOutcome | null {
    const rule = findRule(inputs, opts);
    return rule ? rule.outcome : null;
}
