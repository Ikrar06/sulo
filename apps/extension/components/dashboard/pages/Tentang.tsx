import { browser } from 'wxt/browser';
import { TentangContent } from '@sulo/ui/dashboard/TentangContent';
import type { PageProps } from '../types';

/** About: the shared content with the extension's version and privacy page. */
export function TentangPage({ d, actions }: PageProps) {
  return <TentangContent d={d} version={browser.runtime.getManifest().version} onOpenPrivacy={() => actions.openTab(browser.runtime.getURL('/privacy.html'))} />;
}
