
import { create } from 'zustand';
import type {GameCtx, ReagentId} from '../core/chemistry/types';
import { react } from '../core/reactions/engine';

interface LabStore {
    ctx: GameCtx;
    addReagent: (vesselId: string, reagentId: ReagentId) => void;
    reset: () => void;
}

export const useLabStore = create<LabStore>((set, get) => ({
    // Minimal initial context with one vessel
    ctx: {
        levelId: 'demo',
        vessels: [{ id: 'main-flask', substances: [] }],
        activeEffects: [],
        score: 0,
        timeElapsed: 0,
    },

    addReagent: (vesselId, reagentId) => {
        // Copy current ctx (shallow copy is fine for MVP)
        const ctx = { ...get().ctx };
        const vessel = ctx.vessels.find(v => v.id === vesselId);
        if (!vessel) return;

        // Add a small portion of reagent
        vessel.substances = [...vessel.substances, { id: reagentId, volume: 10 }];

        // Try to react all substances currently in the vessel
        const inputIds = vessel.substances.map(s => s.id);
        const outcome = react(inputIds) ?? undefined;
        vessel.lastOutcome = outcome;

        // Update global active effects exposed to the UI/FX layer
        ctx.activeEffects = outcome?.effectTags ?? [];

        set({ ctx });
    },

    reset: () =>
        set({
                ctx: {
                    levelId: 'demo',
                    vessels: [{ id: 'main-flask', substances: [] }],
                    activeEffects: [],
                    score: 0,
                    timeElapsed: 0,
                },
            }),
}));
