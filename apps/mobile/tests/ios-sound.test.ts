import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }));
vi.mock('@capacitor/core', async (orig) => ({ ...(await orig<typeof import('@capacitor/core')>()), Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true } }));

const { iosSound } = await import('../src/platform/notifications');
const core = await import('@sulo/core/notify/channels');
const { mobileWords } = await import('@sulo/core/i18n/mobile');
const channelPlan = (sound: Parameters<typeof core.channelPlan>[0]) => core.channelPlan(sound, mobileWords('id').notifySound.channels);

describe('iPhone: each notification carries its kind\'s sound', () => {
  it('a reminder plays the chosen Sulo sound from the bundle', () => {
    expect(iosSound(channelPlan('sound2'), 'task|101|t:101:180:1')).toEqual({ sound: 'sulo_notif_2.caf' });
  });

  it('the phone\'s own sound, and silence', () => {
    expect(iosSound(channelPlan('device'), 'task|101|t:101:180:1')).toEqual({ sound: 'default' });
    expect(iosSound(channelPlan('silent'), 'task|101|t:101:180:1')).toEqual({});
  });

  it('the quiet kinds stay quiet: the morning summary and "perlu disegarkan"', () => {
    expect(iosSound(channelPlan('sound1'), 'morning|m:2026-11-27')).toEqual({});
    expect(iosSound(channelPlan('sound1'), 'refresh|1796000000')).toEqual({});
  });
});
