import { useState } from 'react';
import type { Subtask, Task } from '../types';
import { useBoard } from '../store';
import { formatDuration, formatMinutes, moveTask, sortedProjects, taskEstimateSec, uid } from '../logic';

interface Props {
  task: Task;
  onClose: () => void;
}

export function TaskEditor({ task, onClose }: Props) {
  const { data, update } = useBoard();
  const [draft, setDraft] = useState<Task>(task);
  const [newSub, setNewSub] = useState('');
  const [newSubMin, setNewSubMin] = useState(15);

  const save = () => {
    update((d) => {
      const moved = draft.projectId !== task.projectId ? moveTask(d, task.id, draft.projectId, null) : d;
      return {
        ...moved,
        tasks: moved.tasks.map((t) =>
          t.id === task.id ? { ...draft, order: t.order, title: draft.title.trim() || 'Untitled' } : t,
        ),
      };
    });
    onClose();
  };

  const remove = () => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    update((d) => ({
      ...d,
      tasks: d.tasks.filter((t) => t.id !== task.id),
      timer: d.timer?.taskId === task.id ? null : d.timer,
      projects: d.projects.map((p) => (p.activeTaskId === task.id ? { ...p, activeTaskId: null } : p)),
    }));
    onClose();
  };

  const setSub = (id: string, patch: Partial<Subtask>) =>
    setDraft((t) => ({ ...t, subtasks: t.subtasks.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addSub = () => {
    if (!newSub.trim()) return;
    setDraft((t) => ({
      ...t,
      subtasks: [...t.subtasks, { id: uid(), title: newSub.trim(), estimateMin: newSubMin, spentSec: 0, done: false }],
    }));
    setNewSub('');
  };

  return (
    <div className="modal-backdrop" onClick={save}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Edit task">
        <input
          className="title-input"
          value={draft.title}
          autoFocus={!task.title}
          placeholder="Task title"
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <div className="row">
          <label>
            Project
            <select value={draft.projectId} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}>
              {sortedProjects(data).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {draft.subtasks.length === 0 ? (
            <label>
              Estimate (min)
              <input
                type="number"
                min={0}
                step={5}
                value={draft.estimateMin}
                onChange={(e) => setDraft({ ...draft, estimateMin: Math.max(0, Number(e.target.value)) })}
              />
            </label>
          ) : (
            <div className="muted">Estimate: {formatMinutes(taskEstimateSec(draft) / 60)} from sub-tasks</div>
          )}
        </div>
        <textarea
          placeholder="Notes"
          rows={4}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        />

        <h3>Sub-tasks</h3>
        <ul className="subtasks">
          {draft.subtasks.map((s) => (
            <li key={s.id} className={s.done ? 'done' : ''}>
              <input type="checkbox" checked={s.done} onChange={(e) => setSub(s.id, { done: e.target.checked })} />
              <input value={s.title} onChange={(e) => setSub(s.id, { title: e.target.value })} />
              <input
                type="number"
                min={0}
                step={5}
                className="mins"
                value={s.estimateMin}
                onChange={(e) => setSub(s.id, { estimateMin: Math.max(0, Number(e.target.value)) })}
                aria-label="Estimate in minutes"
              />
              <span className="muted spent">{s.spentSec > 0 ? formatDuration(-s.spentSec) : ''}</span>
              <button
                className="icon"
                aria-label="Remove sub-task"
                onClick={() => setDraft((t) => ({ ...t, subtasks: t.subtasks.filter((x) => x.id !== s.id) }))}
              >
                ×
              </button>
            </li>
          ))}
          <li className="add-sub">
            <input
              placeholder="Add a sub-task"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSub()}
            />
            <input
              type="number"
              min={0}
              step={5}
              className="mins"
              value={newSubMin}
              onChange={(e) => setNewSubMin(Math.max(0, Number(e.target.value)))}
              aria-label="Estimate in minutes"
            />
            <button onClick={addSub}>Add</button>
          </li>
        </ul>

        <div className="modal-actions">
          <button className="danger" onClick={remove}>
            Delete
          </button>
          <span className="spacer" />
          <button className="primary" onClick={save}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
