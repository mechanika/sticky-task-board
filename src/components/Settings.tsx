import { useState } from 'react';
import * as drive from '../drive';
import { useBoard } from '../store';
import type { SyncState } from '../useSync';
import type { BoardData } from '../types';

interface Props {
  sync: { state: SyncState; connect: () => void; disconnect: () => void; refresh: () => void };
  onClose: () => void;
}

export function Settings({ sync, onClose }: Props) {
  const [clientId, setClientId] = useState(drive.getClientId());
  const { data, update } = useBoard();

  const saveId = () => {
    drive.setClientId(clientId);
    sync.refresh();
  };

  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sticky-task-board-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (file: File) => {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as BoardData;
        if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.tasks)) throw new Error();
        if (confirm('Replace your current board with this backup?')) update(() => parsed);
      } catch {
        alert('That file is not a Sticky Task Board backup.');
      }
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <h2>Settings</h2>

        <h3>Google Drive sync</h3>
        <p className="muted">
          Your board is saved as a private file in Google Drive's hidden app folder, so every device you sign in on sees the
          same tasks.
        </p>
        <label>
          Google OAuth client ID
          <input value={clientId} placeholder="xxxx.apps.googleusercontent.com" onChange={(e) => setClientId(e.target.value)} />
        </label>
        <div className="row">
          <button onClick={saveId}>Save client ID</button>
          {sync.state === 'off' || sync.state === 'signed-out' ? (
            <button className="primary" disabled={!drive.getClientId()} onClick={sync.connect}>
              Connect Google Drive
            </button>
          ) : (
            <button onClick={sync.disconnect}>Disconnect</button>
          )}
        </div>
        <p className="muted">Status: {sync.state}</p>

        <h3>Backup</h3>
        <div className="row">
          <button onClick={exportFile}>Export JSON</button>
          <label className="file-button">
            Import JSON
            <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
        </div>

        <div className="modal-actions">
          <span className="spacer" />
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
