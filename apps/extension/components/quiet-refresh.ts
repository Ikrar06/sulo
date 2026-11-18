import { useEffect, useRef, useState } from 'react';
import { QUIET_SPIN_MS, UP_TO_DATE_MS } from '@sulo/core/view/refresh-feedback';

/**
 * "Perbarui": the icon turns once (300 ms, not with reduced motion) and,
 * when the click sent nothing because the data is recent, "Sudah terbaru"
 * replaces the last-updated text for two seconds.
 */
export function useQuietRefresh(onRefresh: () => Promise<boolean>) {
  const [spinning, setSpinning] = useState(false);
  const [upToDate, setUpToDate] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const click = () => {
    setSpinning(true);
    timers.current.push(window.setTimeout(() => setSpinning(false), QUIET_SPIN_MS));
    void onRefresh().then((quiet) => {
      if (!quiet) return;
      setUpToDate(true);
      timers.current.push(window.setTimeout(() => setUpToDate(false), UP_TO_DATE_MS));
    });
  };
  return { click, spinning, upToDate };
}
