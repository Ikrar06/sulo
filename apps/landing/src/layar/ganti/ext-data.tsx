// Stand-in for apps/extension/components/dashboard/data.tsx: the pages take
// their data as props on the landing page; nothing here reads chrome.storage.
import type { ReactNode } from 'react';
import { memoryStore } from './memory-store';

export const local = memoryStore();
export const timeZone = 'Asia/Makassar';
export type { DashboardData } from '@sulo/core/view/dashboard-data';

export function DashboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function useDashboard(): never {
  throw new Error('useDashboard: the landing page renders the pages with props');
}
