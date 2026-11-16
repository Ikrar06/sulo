import type { Route } from '@/lib/dashboard/routes';
import type { DashMessages } from '@/lib/i18n/dashboard';
import type { DashboardActions, DashboardData } from './data';

/** What every dashboard page receives. */
export interface PageProps {
  d: DashMessages;
  data: DashboardData;
  actions: DashboardActions;
  route: Route;
}
