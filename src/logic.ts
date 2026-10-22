import type { BoardData, Project, Task } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const COLORS = ['#ffd966', '#9fe2bf', '#a8c8ff', '#ffb3c6', '#d5b8ff', '#ffc49b'];

export function taskEstimateSec(task: Task): number {
  if (task.subtasks.length === 0) return task.estimateMin * 60;
  return task.subtasks.reduce((sum, s) => sum + s.estimateMin * 60, 0);
}

export function taskSpentSec(task: Task): number {
  return task.spentSec + task.subtasks.reduce((sum, s) => sum + s.spentSec, 0);
}

export function openTasks(data: BoardData, projectId: string): Task[] {
  return data.tasks
    .filter((t) => t.projectId === projectId && t.completedAt === null)
    .sort((a, b) => a.order - b.order);
}

export function completedTasks(data: BoardData): Task[] {
  return data.tasks.filter((t) => t.completedAt !== null).sort((a, b) => b.completedAt! - a.completedAt!);
}

export function sortedProjects(data: BoardData): Project[] {
  return [...data.projects].sort((a, b) => a.order - b.order);
}

/** The project's active task, falling back to the first open task in its column. */
export function activeTask(data: BoardData, projectId: string): Task | null {
  const project = data.projects.find((p) => p.id === projectId);
  const open = openTasks(data, projectId);
  return open.find((t) => t.id === project?.activeTaskId) ?? open[0] ?? null;
}

/** Bank the running timer's elapsed time into the task (or sub-task) and clear it. */
export function stopTimer(data: BoardData, now: number): BoardData {
  const timer = data.timer;
  if (!timer) return data;
  const elapsed = Math.max(0, Math.round((now - timer.startedAt) / 1000));
  return {
    ...data,
    timer: null,
    tasks: data.tasks.map((t) => {
      if (t.id !== timer.taskId) return t;
      const sub = timer.subtaskId && t.subtasks.find((s) => s.id === timer.subtaskId);
      if (sub) {
        return { ...t, subtasks: t.subtasks.map((s) => (s === sub ? { ...s, spentSec: s.spentSec + elapsed } : s)) };
      }
      return { ...t, spentSec: t.spentSec + elapsed };
    }),
  };
}

/** The first unfinished sub-task, which is where running time is booked. */
export function currentSubtaskId(task: Task): string | null {
  return task.subtasks.find((s) => !s.done)?.id ?? null;
}

export function startTimer(data: BoardData, taskId: string, now: number): BoardData {
  const stopped = stopTimer(data, now);
  const task = stopped.tasks.find((t) => t.id === taskId);
  if (!task) return stopped;
  return {
    ...stopped,
    timer: { taskId, subtaskId: currentSubtaskId(task), startedAt: now },
    projects: stopped.projects.map((p) => (p.id === task.projectId ? { ...p, activeTaskId: taskId } : p)),
  };
}

/**
 * Check a task off: bank its time, move it to Completed, and make the next
 * task down the same column active.
 */
export function completeTask(data: BoardData, taskId: string, now: number): BoardData {
  const wasRunning = data.timer?.taskId === taskId;
  let next = wasRunning ? stopTimer(data, now) : data;
  const task = next.tasks.find((t) => t.id === taskId);
  if (!task) return next;
  const open = openTasks(next, task.projectId);
  const following = open.find((t) => t.order > task.order) ?? open.find((t) => t.id !== taskId) ?? null;
  next = {
    ...next,
    tasks: next.tasks.map((t) => (t.id === taskId ? { ...t, completedAt: now } : t)),
    projects: next.projects.map((p) =>
      p.id === task.projectId && (p.activeTaskId === taskId || p.activeTaskId === null)
        ? { ...p, activeTaskId: following?.id ?? null }
        : p,
    ),
  };
  return next;
}

export function reopenTask(data: BoardData, taskId: string): BoardData {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return data;
  const maxOrder = Math.max(0, ...openTasks(data, task.projectId).map((t) => t.order));
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === taskId ? { ...t, completedAt: null, order: maxOrder + 1 } : t)),
  };
}

/** Move a task into a column, before `beforeId` or at the end. Renumbers the column. */
export function moveTask(data: BoardData, taskId: string, projectId: string, beforeId: string | null): BoardData {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || taskId === beforeId) return data;
  const column = openTasks(data, projectId).filter((t) => t.id !== taskId);
  const at = beforeId ? column.findIndex((t) => t.id === beforeId) : -1;
  column.splice(at < 0 ? column.length : at, 0, { ...task, projectId });
  const orders = new Map(column.map((t, i) => [t.id, i]));
  const leftProject = task.projectId !== projectId ? task.projectId : null;
  return {
    ...data,
    tasks: data.tasks.map((t) =>
      orders.has(t.id) ? { ...t, projectId, order: orders.get(t.id)! } : t,
    ),
    projects: data.projects.map((p) =>
      p.id === leftProject && p.activeTaskId === taskId ? { ...p, activeTaskId: null } : p,
    ),
  };
}

/** Move a project column to where `targetId` sits, shifting the others along. */
export function moveProject(data: BoardData, projectId: string, targetId: string): BoardData {
  const list = sortedProjects(data);
  const from = list.findIndex((p) => p.id === projectId);
  const to = list.findIndex((p) => p.id === targetId);
  if (from < 0 || to < 0 || from === to) return data;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  const orders = new Map(list.map((p, i) => [p.id, i]));
  return { ...data, projects: data.projects.map((p) => ({ ...p, order: orders.get(p.id)! })) };
}

export function formatDuration(sec: number): string {
  const neg = sec < 0;
  const s = Math.abs(Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const body = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
  return neg ? `+${body}` : body;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function emptyBoard(): BoardData {
  const work = uid();
  const home = uid();
  const t = (projectId: string, title: string, estimateMin: number, order: number): Task => ({
    id: uid(), projectId, title, notes: '', estimateMin, spentSec: 0, subtasks: [], order, completedAt: null,
  });
  const plan = t(work, 'Plan the week', 30, 0);
  plan.subtasks = [
    { id: uid(), title: 'Review last week', estimateMin: 10, spentSec: 0, done: false },
    { id: uid(), title: 'Pick top three goals', estimateMin: 20, spentSec: 0, done: false },
  ];
  return {
    projects: [
      { id: work, name: 'Work', color: COLORS[0], order: 0, activeTaskId: null },
      { id: home, name: 'Home', color: COLORS[1], order: 1, activeTaskId: null },
    ],
    tasks: [plan, t(work, 'Answer emails', 20, 1), t(home, 'Book car service', 10, 0)],
    timer: null,
    updatedAt: 0,
  };
}
