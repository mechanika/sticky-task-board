import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoard } from './store';
import * as drive from './drive';

export type SyncState = 'off' | 'signed-out' | 'syncing' | 'synced' | 'error';

/** Keeps the board in step with Google Drive: pull on start and focus, push shortly after each change. */
export function useSync() {
  const [state, setState] = useState<SyncState>(drive.getClientId() ? 'signed-out' : 'off');
  const lastSynced = useRef(0);
  const busy = useRef(false);

  const sync = useCallback(async (interactive = false) => {
    if (busy.current) return;
    if (!drive.getClientId()) return setState('off');
    busy.current = true;
    try {
      if (!(await drive.signIn(interactive))) {
        setState('signed-out');
        return;
      }
      setState('syncing');
      const remote = await drive.pull();
      const local = useBoard.getState().data;
      if (remote && remote.updatedAt > local.updatedAt) {
        useBoard.getState().replace(remote);
        lastSynced.current = remote.updatedAt;
      } else if (!remote || local.updatedAt > remote.updatedAt) {
        await drive.push(local);
        lastSynced.current = local.updatedAt;
      }
      setState('synced');
    } catch {
      setState('error');
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (drive.wasLinked()) sync(false);
    const onFocus = () => drive.wasLinked() && sync(false);
    const onVisible = () => document.visibilityState === 'visible' && onFocus();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const unsub = useBoard.subscribe((s) => {
      if (!drive.wasLinked() || s.data.updatedAt <= lastSynced.current) return;
      clearTimeout(timeout);
      timeout = setTimeout(() => sync(false), 1500);
    });
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      unsub();
      clearTimeout(timeout);
    };
  }, [sync]);

  const disconnect = useCallback(() => {
    drive.signOut();
    setState(drive.getClientId() ? 'signed-out' : 'off');
  }, []);

  return { state, connect: () => sync(true), disconnect, refresh: () => setState(drive.getClientId() ? 'signed-out' : 'off') };
}
