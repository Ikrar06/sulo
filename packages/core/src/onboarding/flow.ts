// Onboarding as a list of steps, not a sequence written into the page. The
// progress indicator and navigation read from this list, so later modules
// can add a step (for example an optional NEOSIA step after the courses)
// without touching the page logic. Pure functions, tested in Vitest.

import type { OnboardingState } from '../storage';

export interface FlowContext {
  /** The user finished onboarding before (reopened from the popup). */
  completed: boolean;
  /** switch-account starts at the connect step: the notice was already read. */
  mode?: 'first-run' | 'switch-account';
}

export interface StepDef<Id extends string = string> {
  id: Id;
  /** Optional steps show "Lewati dulu"; a skipped step can be reopened later. */
  optional: boolean;
  show: (ctx: FlowContext) => boolean;
}

export type M2StepId = 'intro' | 'connect' | 'courses' | 'done';

/** M2: four required steps. */
export const ONBOARDING_STEPS: readonly StepDef<M2StepId>[] = [
  { id: 'intro', optional: false, show: (ctx) => ctx.mode !== 'switch-account' },
  { id: 'connect', optional: false, show: () => true },
  { id: 'courses', optional: false, show: () => true },
  { id: 'done', optional: false, show: () => true },
];

export function visibleSteps<Id extends string>(steps: readonly StepDef<Id>[], ctx: FlowContext): StepDef<Id>[] {
  return steps.filter((s) => s.show(ctx));
}

export function nextStep<Id extends string>(steps: readonly StepDef<Id>[], current: Id): Id | null {
  const i = steps.findIndex((s) => s.id === current);
  return i >= 0 && i + 1 < steps.length ? steps[i + 1]!.id : null;
}

export function previousStep<Id extends string>(steps: readonly StepDef<Id>[], current: Id): Id | null {
  const i = steps.findIndex((s) => s.id === current);
  return i > 0 ? steps[i - 1]!.id : null;
}

export function progressOf<Id extends string>(steps: readonly StepDef<Id>[], current: Id): { position: number; total: number } {
  return { position: steps.findIndex((s) => s.id === current) + 1, total: steps.length };
}

/** Records a skipped optional step, so the dashboard can offer it again later. */
export function skipStep(state: OnboardingState, step: StepDef): OnboardingState {
  if (!step.optional) throw new Error(`step ${step.id} is required and cannot be skipped`);
  const skipped = state.skippedSteps ?? [];
  return skipped.includes(step.id) ? state : { ...state, skippedSteps: [...skipped, step.id] };
}
