// Course structure snapshot from core_courseformat_get_state, keyed by cm.id.
// Pure. The activity kind comes from `module` (a code), never `modname`
// (translated display text).

import type { FunctionData } from '../moodle/schemas';
import type { CourseId, CourseSnapshot, SnapshotItem, UnixSeconds, UserId } from '../types';
import { PARSER_VERSION } from '../types';

type CourseState = FunctionData<'core_courseformat_get_state'>;

export type FreshItem = Omit<SnapshotItem, 'firstSeenAt' | 'missCount'>;

export function itemsFromState(state: CourseState): FreshItem[] {
  return state.cm.map((cm) => ({
    cmId: cm.id,
    module: cm.module,
    name: cm.name,
    sectionId: cm.sectionid,
    visible: cm.visible,
    uservisible: cm.uservisible,
    url: cm.url ?? null,
  }));
}

export function emptySnapshot(userId: UserId, courseId: CourseId, now: UnixSeconds): CourseSnapshot {
  return { userId, courseId, fetchedAt: now, parserVersion: PARSER_VERSION, items: {} };
}
