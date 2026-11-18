import type { Route } from '@sulo/core/dashboard/routes';
import type { DashMessages } from '@sulo/core/i18n/dashboard';
import type { DashboardActions, DashboardData } from './data';

/** What every dashboard page receives. */
export interface PageProps {
  d: DashMessages;
  data: DashboardData;
  actions: DashboardActions;
  route: Route;
}
