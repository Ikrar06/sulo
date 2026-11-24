// The extension's popup as the extension draws it (PopupView, 380 px wide),
// with the sample data and no actions (NO_ACTIONS: it is a picture, nothing
// in it does anything). For the bento tile "On a laptop and a phone".
import type { DashboardData } from '@sulo/core/view/dashboard-data';
import { I18nProvider } from '@sulo/ui/i18n';
import { NO_ACTIONS, PopupView } from '../../../extension/components/popup/PopupView';
import { ZONA } from './contoh';
import type { Bahasa } from '../teks';

export function LayarPopup({ data, bahasa }: { data: DashboardData; bahasa: Bahasa }) {
  return (
    <I18nProvider locale={bahasa}>
      <PopupView {...NO_ACTIONS} view={data.view} now={data.now} timeZone={ZONA} dueFormat={data.prefs.dueFormat} reminders={data.prefs.reminders} updatesSettings={data.prefs.updates} />
    </I18nProvider>
  );
}
