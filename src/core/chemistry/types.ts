// chemistry/types.ts

// --- Basic identifiers ---
export type ReagentId = string;
export type VesselId = string;
export type LevelId = string;

// --- Common effect tags your FX layer can listen to ---
export type EffectTag =
    | 'bubbles'      // gas bubbles inside a vessel
    | 'foam'         // foamy eruption
    | 'smoke'        // light smoke over the vessel
    | 'spark'        // small sparks
    | 'flame_na'     // sodium flame color
    | 'flame_k'      // potassium flame color
    | 'flame_cu'     // copper flame color
    | 'precipitate'; // visible precipitate formed

// --- Domain entities (static data) ---

/** A chemical reagent definition (catalog item). */
export interface Reagent {
    id: ReagentId;
    name: string;                 // Human-readable name
    formula?: string;             // e.g., "HCl"
    smiles?: string;              // optional structural string
    state: 'solid' | 'liquid' | 'gas';
    baseColor?: string;           // base liquid color (hex or css name)
    hazard?: 'low' | 'mid' | 'high';
    // Optional coarse acidity/basicity hints for MVP logic (not rigorous)
    phHint?: 'acidic' | 'basic' | 'neutral';
}

/** Optional conditions to match a reaction rule. */
export interface ReactionCondition {
    temperature?: 'room' | 'hot' | 'cold';
    catalyst?: ReagentId; // id of required catalyst, if any
    flame?: boolean;      // flame present (for flame tests)
}

/** Visual/semantic outcome of a reaction (what the player should "see"). */
export interface ReactionOutcome {
    products: ReagentId[]; // resulting product ids (for inventory/log)
    gas?: boolean;         // gas produced
    precipitate?: { color?: string; speed?: 'fast' | 'slow' };
    flame?: 'na' | 'k' | 'cu'; // flame color test
    colorChange?: string;      // resulting solution tint
    exothermic?: boolean;      // heat produced
    effectTags?: EffectTag[];  // FX triggers
    score?: number;            // suggested score reward
}

/** Declarative reaction rule: inputs (+conditions) -> outcome. */
export interface ReactionRule {
    id: string;
    inputs: ReagentId[];            // order-agnostic list of reagents
    conditions?: ReactionCondition; // optional constraints
    outcome: ReactionOutcome;       // what happens if rule matches
    hint?: string;                  // short hint for UI
}

// --- Runtime state (mutable during gameplay) ---

/** Portion of a reagent currently present in a vessel. */
export interface SubstanceState {
    id: ReagentId;         // reagent id
    volume: number;        // in mL (or arbitrary unit for MVP)
    concentration?: number; // optional (0..1) for acids/bases etc.
}

/** A lab vessel state (beaker/flask) during a level. */
export interface VesselState {
    id: VesselId;
    substances: SubstanceState[]; // mixture inside
    lastOutcome?: ReactionOutcome; // last applied outcome (for UI/FX)
    // Optional derived values you may compute and store:
    phApprox?: number;            // coarse pH estimate for HUD
    temperature?: 'room' | 'hot' | 'cold';
}

/** Global game snapshot passed to goal checks and systems. */
export interface GameCtx {
    levelId: LevelId;
    vessels: VesselState[];
    activeEffects: EffectTag[]; // global/transient FX flags (e.g., 'bubbles')
    score: number;
    timeElapsed: number;        // seconds since level start
    attemptsUsed?: number;      // optional, for scoring
}

// --- Goals ---

/** A level goal that decides when the player has succeeded. */
export interface LevelGoal {
    id: string;
    title: string;                    // e.g., "Create a milky precipitate"
    check: (ctx: GameCtx) => boolean; // pure function: ctx -> passed?
    reward: number;                   // base reward on success
}
