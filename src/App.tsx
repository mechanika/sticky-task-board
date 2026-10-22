import { useEffect, useState } from 'react';
import { useBoard } from './store';
import { useSync } from './useSync';
import { wasLinked } from './drive';
import { openTasks, sortedProjects, uid } from './logic';
import type { Task } from './types';
import { Board } from './components/Board';
import { FocusView, RunningBar } from './components/FocusView';
import { MindMap } from './components/MindMap';
import { Completed } from './components/Completed';
import { TaskEditor } from './components/TaskEditor';
import { Settings } from './components/Settings';

type View = 'board' | 'focus' | 'map' | 'done';
const VIEWS: { id: View; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'focus', label: 'Focus' },
  { id: 'map', label: 'Map' },
  { id: 'done', label: 'Done' },
];

function initialView(): View {
  const v = new URLSearchParams(location.search).get('view') || localStorage.getItem('stb.view');
  return VIEWS.some((x) => x.id === v) ? (v as View) : 'board';
}

export default function App() {
  const { data, update } = useBoard();
  const sync = useSync();
  const [view, setView] = useState<View>(initialView);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusProject, setFocusProject] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);

  useEffect(() => localStorage.setItem('stb.view', view), [view]);
  const editing = data.tasks.find((t) => t.id === editingId) ?? null;

  const addTask = (projectId: string, title = '', estimateMin = 15): Task => {
    const task: Task = {
      id: uid(),
      projectId,
      title,
      notes: '',
      estimateMin,
      spentSec: 0,
      subtasks: [],
      order: Math.max(-1, ...openTasks(data, projectId).map((t) => t.order)) + 1,
      completedAt: null,
    };
    update((d) => ({ ...d, tasks: [...d.tasks, task] }));
    return task;
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Tasks</h1>
        <nav>
          {VIEWS.map((v) => (
            <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </nav>
        <button className={`sync-dot ${sync.state}`} onClick={() => setShowSettings(true)} title={`Sync: ${sync.state}`}>
          ⚙
        </button>
      </header>
      {sync.state === 'signed-out' && wasLinked() && (
        <button className="sync-banner" onClick={sync.connect}>
          Tap to reconnect Google Drive sync
        </button>
      )}
      {view !== 'focus' && <RunningBar onOpen={() => setView('focus')} />}

      <main>
        {view === 'board' && <Board onEdit={(t) => setEditingId(t.id)} onAddTask={(pid) => setEditingId(addTask(pid).id)} />}
        {view === 'focus' && (
          <FocusView
            projectId={focusProject ?? (data.timer && data.tasks.find((t) => t.id === data.timer!.taskId)?.projectId) ?? null}
            onProject={setFocusProject}
            onEdit={(t) => setEditingId(t.id)}
          />
        )}
        {view === 'map' && <MindMap onEdit={(t) => setEditingId(t.id)} />}
        {view === 'done' && <Completed />}
      </main>

      {data.projects.length > 0 && (
        <button className="fab" aria-label="Quick add task" onClick={() => setQuickAdd(true)}>
          +
        </button>
      )}
      {quickAdd && <QuickAdd onAdd={addTask} onClose={() => setQuickAdd(false)} defaultProject={focusProject} />}
      {editing && <TaskEditor key={editing.id} task={editing} onClose={() => setEditingId(null)} />}
      {showSettings && <Settings sync={sync} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function QuickAdd({
  onAdd,
  onClose,
  defaultProject,
}: {
  onAdd: (projectId: string, title: string, estimateMin: number) => void;
  onClose: () => void;
  defaultProject: string | null;
}) {
  const { data } = useBoard();
  const projects = sortedProjects(data);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(
    defaultProject && projects.some((p) => p.id === defaultProject) ? defaultProject : projects[0].id,
  );
  const [estimate, setEstimate] = useState(15);

  const submit = (keepOpen: boolean) => {
    if (!title.trim()) return;
    onAdd(projectId, title.trim(), estimate);
    setTitle('');
    if (!keepOpen) onClose();
  };

  return (
    <div className="modal-backdrop sheet" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          submit(true);
        }}
      >
        <input className="title-input" autoFocus placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="project-pills">
          {projects.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`pill ${p.id === projectId ? 'on' : ''}`}
              style={{ ['--accent' as string]: p.color }}
              onClick={() => setProjectId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="row estimates">
          {[5, 15, 30, 60, 120].map((m) => (
            <button type="button" key={m} className={`chip ${estimate === m ? 'on' : ''}`} onClick={() => setEstimate(m)}>
              {m < 60 ? `${m}m` : `${m / 60}h`}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <span className="spacer" />
          <button type="submit">Add another</button>
          <button type="button" className="primary" onClick={() => submit(false)}>
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
