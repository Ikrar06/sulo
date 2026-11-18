// Which updates may notify ("Kabar terbaru" panel). Device-wide, stored in
// the preferences. Everything is still logged; these only gate notifications.

import { z } from 'zod';
import type { Change } from '../types';

export type UpdateCategory = 'materials' | 'deadlines' | 'grades' | 'forum';
export const UPDATE_CATEGORIES: readonly UpdateCategory[] = ['materials', 'deadlines', 'grades', 'forum'];

export type UpdateSettings = Record<UpdateCategory, boolean>;
export const DEFAULT_UPDATES: UpdateSettings = { materials: true, deadlines: true, grades: true, forum: true };

export const updateSettingsSchema = z
  .object({ materials: z.boolean(), deadlines: z.boolean(), grades: z.boolean(), forum: z.boolean() })
  .catch(DEFAULT_UPDATES);

export function categoryOf(change: Change): UpdateCategory | null {
  switch (change.kind) {
    case 'added':
    case 'shown':
    case 'task_added':
      return 'materials';
    case 'due_changed':
      return 'deadlines';
    case 'grade_feedback':
    case 'neosia_grade':
      return 'grades';
    case 'forum':
      return 'forum';
    default:
      return null;
  }
}
