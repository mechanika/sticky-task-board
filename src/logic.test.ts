import { describe, expect, it } from 'vitest';
import type { BoardData, Task } from './types';
import { activeTask, completeTask, moveTask, openTasks, startTimer, stopTimer, taskEstimateSec } from './logic';

function board(): BoardData {
  const t = (id: string, order: number, projectId = 'p1'): Task => ({
    id, projectId, title: id, notes: '', estimateMin: 10, spentSec: 0, subtasks: [], order, completedAt: null,
  });
  return {
    projects: [
      { id: 'p1', name: 'One', color: '#fff', order: 0, activeTaskId: 'b' },
      { id: 'p2', name: 'Two', color: '#fff', order: 1, activeTaskId: null },
    ],
    tasks: [t('a', 0), t('b', 1), t('c', 2), t('x', 0, 'p2')],
    timer: null,
    updatedAt: 0,
  };
}

describe('completeTask', () => {
  it('moves the task to completed and activates the next one down the column', () => {
    const next = completeTask(board(), 'b', 1000);
    expect(next.tasks.find((t) => t.id === 'b')!.completedAt).toBe(1000);
    expect(activeTask(next, 'p1')!.id).toBe('c');
  });

  it('wraps to the top of the column when the last task is completed', () => {
    let d = board();
    d = { ...d, projects: d.projects.map((p) => (p.id === 'p1' ? { ...p, activeTaskId: 'c' } : p)) };
    expect(activeTask(completeTask(d, 'c', 1), 'p1')!.id).toBe('a');
  });

  it('banks running time before completing', () => {
    let d = startTimer(board(), 'b', 0);
    d = completeTask(d, 'b', 90_000);
    expect(d.timer).toBeNull();
    expect(d.tasks.find((t) => t.id === 'b')!.spentSec).toBe(90);
  });
});

describe('timer', () => {
  it('books time against the first unfinished sub-task', () => {
    let d = board();
    d.tasks[0].subtasks = [
      { id: 's1', title: 's1', estimateMin: 5, spentSec: 0, done: true },
      { id: 's2', title: 's2', estimateMin: 20, spentSec: 0, done: false },
    ];
    d = stopTimer(startTimer(d, 'a', 0), 60_000);
    expect(d.tasks[0].subtasks[1].spentSec).toBe(60);
    expect(taskEstimateSec(d.tasks[0])).toBe(25 * 60);
  });
});

describe('moveTask', () => {
  it('moves a task into another column before a given task', () => {
    const d = moveTask(board(), 'a', 'p2', 'x');
    expect(openTasks(d, 'p2').map((t) => t.id)).toEqual(['a', 'x']);
    expect(openTasks(d, 'p1').map((t) => t.id)).toEqual(['b', 'c']);
  });

  it('reorders within a column', () => {
    const d = moveTask(board(), 'c', 'p1', 'a');
    expect(openTasks(d, 'p1').map((t) => t.id)).toEqual(['c', 'a', 'b']);
  });
});
