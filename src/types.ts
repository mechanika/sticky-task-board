export interface Subtask {
  id: string;
  title: string;
  estimateMin: number;
  spentSec: number;
  done: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  notes: string;
  /** Used only when the task has no sub-tasks; otherwise the sub-task estimates add up. */
  estimateMin: number;
  spentSec: number;
  subtasks: Subtask[];
  order: number;
  completedAt: number | null;
  /** Just a message or communication needed, shown with a speech bubble on the board. */
  message?: boolean;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  order: number;
  activeTaskId: string | null;
}

export interface Timer {
  taskId: string;
  /** Sub-task the time is being booked against, if any. */
  subtaskId: string | null;
  startedAt: number;
}

export interface BoardData {
  projects: Project[];
  tasks: Task[];
  timer: Timer | null;
  /** Last local change, used for last-write-wins sync with Google Drive. */
  updatedAt: number;
}
