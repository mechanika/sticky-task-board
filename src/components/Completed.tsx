import { useBoard } from '../store';
import { completedTasks, formatDuration, formatMinutes, reopenTask, taskEstimateSec, taskSpentSec } from '../logic';

export function Completed() {
  const { data, update } = useBoard();
  const done = completedTasks(data);
  if (done.length === 0) return <p className="empty">Completed tasks will land here.</p>;

  const clear = () => {
    if (!confirm(`Permanently remove all ${done.length} completed tasks?`)) return;
    update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.completedAt === null) }));
  };

  return (
    <div className="completed">
      <div className="completed-head">
        <h2>Completed</h2>
        <button className="danger" onClick={clear}>
          Clear all
        </button>
      </div>
      <ul>
        {done.map((t) => {
          const project = data.projects.find((p) => p.id === t.projectId);
          return (
            <li key={t.id} style={{ ['--accent' as string]: project?.color ?? '#ccc' }}>
              <span className="dot" />
              <span className="title">{t.title}</span>
              <span className="muted">
                {project?.name ?? 'No project'} · {new Date(t.completedAt!).toLocaleDateString()} · took{' '}
                {formatDuration(-taskSpentSec(t)).replace('+', '')} of {formatMinutes(Math.round(taskEstimateSec(t) / 60))}
              </span>
              <button className="chip" onClick={() => update((d) => reopenTask(d, t.id))}>
                Reopen
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
