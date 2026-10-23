import { useBoard } from '../store';
import {
  activeTask,
  completeTask,
  currentSubtaskId,
  formatMinutes,
  openTasks,
  sortedProjects,
  startTimer,
  stopTimer,
  taskEstimateSec,
  taskSpentSec,
} from '../logic';
import { TimerRing } from './TimerRing';
import type { Task } from '../types';

interface Props {
  projectId: string | null;
  onProject: (id: string) => void;
  onEdit: (task: Task) => void;
}

/** Minimal "next task" view: one project's active task, its countdown ring, and what's up next. */
export function FocusView({ projectId, onProject, onEdit }: Props) {
  const { data, update } = useBoard();
  const projects = sortedProjects(data);
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  if (!project) return <p className="empty">Add a project on the board first.</p>;

  const task = activeTask(data, project.id);
  const queue = openTasks(data, project.id).filter((t) => t.id !== task?.id);
  const running = !!task && data.timer?.taskId === task.id;
  // The sub-task the timer books to: the running one, or the next unfinished one.
  const currentSubId = running ? data.timer!.subtaskId : task && currentSubtaskId(task);
  const currentSub = task?.subtasks.find((s) => s.id === currentSubId) ?? null;

  const toggleSub = (id: string) =>
    update((d) => {
      // Bank time against the current sub-task before switching to the next one.
      const wasRunning = d.timer?.taskId === task!.id;
      let next = wasRunning ? stopTimer(d, Date.now()) : d;
      next = {
        ...next,
        tasks: next.tasks.map((t) =>
          t.id === task!.id ? { ...t, subtasks: t.subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) } : t,
        ),
      };
      return wasRunning ? startTimer(next, task!.id, Date.now()) : next;
    });

  return (
    <div className="focus" style={{ ['--accent' as string]: project.color }}>
      <div className="project-pills">
        {projects.map((p) => (
          <button
            key={p.id}
            className={`pill ${p.id === project.id ? 'on' : ''}`}
            style={{ ['--accent' as string]: p.color }}
            onClick={() => onProject(p.id)}
          >
            {p.name}
            <span className="count">{openTasks(data, p.id).length}</span>
          </button>
        ))}
      </div>

      {task ? (
        <div className="focus-main">
          <TimerRing
            estimateSec={taskEstimateSec(task)}
            spentSec={taskSpentSec(task)}
            startedAt={running ? data.timer!.startedAt : null}
            inner={currentSub && { estimateSec: currentSub.estimateMin * 60, spentSec: currentSub.spentSec, title: currentSub.title }}
          />
          <h2 onClick={() => onEdit(task)}>{task.title}</h2>
          {task.subtasks.length > 0 && (
            <ul className="focus-subs">
              {task.subtasks.map((s) => (
                <li key={s.id} className={s.done ? 'done' : ''}>
                  <label>
                    <input type="checkbox" checked={s.done} onChange={() => toggleSub(s.id)} />
                    {s.title}
                  </label>
                  <span className="muted">{formatMinutes(s.estimateMin)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="focus-actions">
            <button
              className="primary big"
              onClick={() => update((d) => (running ? stopTimer(d, Date.now()) : startTimer(d, task.id, Date.now())))}
            >
              {running ? 'Pause' : 'Start'}
            </button>
            <button className="big done-btn" onClick={() => update((d) => completeTask(d, task.id, Date.now()))}>
              ✓ Complete
            </button>
          </div>
        </div>
      ) : (
        <p className="empty">Nothing left in {project.name}. Nice work.</p>
      )}

      {queue.length > 0 && (
        <div className="up-next">
          <h3>Up next</h3>
          <ol>
            {queue.slice(0, 5).map((t) => (
              <li key={t.id}>
                <span onClick={() => onEdit(t)}>{t.title}</span>
                <span className="muted">{formatMinutes(Math.round(taskEstimateSec(t) / 60))}</span>
                <button
                  className="chip"
                  onClick={() =>
                    update((d) => ({
                      ...stopTimer(d, Date.now()),
                      projects: d.projects.map((p) => (p.id === project.id ? { ...p, activeTaskId: t.id } : p)),
                    }))
                  }
                >
                  Set active
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Slim bar pinned to the top of every view while a timer runs. */
export function RunningBar({ onOpen }: { onOpen: () => void }) {
  const { data, update } = useBoard();
  const task = data.timer && data.tasks.find((t) => t.id === data.timer!.taskId);
  if (!task) return null;
  return (
    <div className="running-bar" onClick={onOpen}>
      <TimerRing size={36} estimateSec={taskEstimateSec(task)} spentSec={taskSpentSec(task)} startedAt={data.timer!.startedAt} />
      <span className="running-title">{task.title}</span>
      <button
        className="chip"
        onClick={(e) => {
          e.stopPropagation();
          update((d) => stopTimer(d, Date.now()));
        }}
      >
        Pause
      </button>
      <button
        className="chip"
        onClick={(e) => {
          e.stopPropagation();
          update((d) => completeTask(d, task.id, Date.now()));
        }}
      >
        ✓
      </button>
    </div>
  );
}
