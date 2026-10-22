// Google Drive sync. The whole board lives in one JSON file in the app's
// private appDataFolder, which only this app can see. Last write wins,
// compared by BoardData.updatedAt.
import type { BoardData } from './types';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'sticky-task-board.json';
const CLIENT_ID_KEY = 'stb.googleClientId';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
  }
}

let token: { value: string; expiresAt: number } | null = null;
let fileId: string | null = null;

export function getClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
}

export function setClientId(id: string) {
  localStorage.setItem(CLIENT_ID_KEY, id.trim());
  token = null;
}

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
}

export function isSignedIn(): boolean {
  return !!token && token.expiresAt > Date.now() + 30_000;
}

/** Ask Google for an access token. `interactive` shows the consent popup if needed. */
export async function signIn(interactive: boolean): Promise<boolean> {
  const clientId = getClientId();
  if (!clientId) return false;
  if (isSignedIn()) return true;
  await loadGis();
  return new Promise((resolve) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      prompt: interactive ? '' : 'none',
      callback: (resp: any) => {
        if (resp.error || !resp.access_token) return resolve(false);
        token = { value: resp.access_token, expiresAt: Date.now() + resp.expires_in * 1000 };
        localStorage.setItem('stb.driveLinked', '1');
        resolve(true);
      },
      error_callback: () => resolve(false),
    });
    client.requestAccessToken();
  });
}

export function signOut() {
  if (token) window.google?.accounts?.oauth2?.revoke(token.value);
  token = null;
  fileId = null;
  localStorage.removeItem('stb.driveLinked');
}

export const wasLinked = () => localStorage.getItem('stb.driveLinked') === '1';

async function api(url: string, init: RequestInit = {}): Promise<Response> {
  if (!token) throw new Error('Not signed in to Google');
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token.value}` },
  });
  if (res.status === 401) token = null;
  if (!res.ok) throw new Error(`Google Drive error ${res.status}`);
  return res;
}

async function findFile(): Promise<string | null> {
  if (fileId) return fileId;
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const res = await api(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)`);
  const body = await res.json();
  fileId = body.files?.[0]?.id ?? null;
  return fileId;
}

export async function pull(): Promise<BoardData | null> {
  const id = await findFile();
  if (!id) return null;
  const res = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  return (await res.json()) as BoardData;
}

export async function push(data: BoardData): Promise<void> {
  const id = await findFile();
  const boundary = 'stb' + Math.random().toString(36).slice(2);
  const meta = id ? {} : { name: FILE_NAME, parents: ['appDataFolder'] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
  const url = id
    ? `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
  const res = await api(url, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!id) fileId = (await res.json()).id;
}
