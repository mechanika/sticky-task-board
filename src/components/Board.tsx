import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Project, Task } from '../types';
import { useBoard } from '../store';
import {
  COLORS,
  activeTask,
  completeTask,
  formatMinutes,
  moveTask,
  openTasks,
  sortedProjects,
  startTimer,
  stopTimer,
  taskEstimateSec,
  uid,
} from '../logic';

interface Props {
  onEdit: (task: Task) => void;
  onAddTask: (projectId: string) => void;
}

export function Board({ onEdit, onAddTask }: Props) {
  const { data, update } = useBoard();
  const [dragging, setDragging] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const over = e.over?.data.current as { projectId: string; beforeId: string | null } | undefined;
    if (!over) return;
    update((d) => moveTask(d, String(e.active.id), over.projectId, over.beforeId));
  };

  const addProject = () => {
    const name = prompt('Project name');
    if (!name?.trim()) return;
    update((d) => ({
      ...d,
      projects: [
        ...d.projects,
        {
          id: uid(),
          name: name.trim(),
          color: COLORS[d.projects.length % COLORS.length],
          order: Math.max(-1, ...d.projects.map((p) => p.order)) + 1,
          activeTaskId: null,
        },
      ],
    }));
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragging(data.tasks.find((t) => t.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="board">
        {sortedProjects(data).map((p) => (
          <Column key={p.id} project={p} onEdit={onEdit} onAddTask={onAddTask} />
        ))}
        <button className="add-column" onClick={addProject}>
          + Project
        </button>
      </div>
      <DragOverlay>{dragging && <Card task={dragging} color={colorOf(dragging)} overlay />}</DragOverlay>
    </DndContext>
  );

  function colorOf(t: Task) {
    return data.projects.find((p) => p.id === t.projectId)?.color ?? COLORS[0];
  }
}

function Column({ project, onEdit, onAddTask }: { project: Project } & Props) {
  const { data, update } = useBoard();
  const tasks = openTasks(data, project.id);
  const active = activeTask(data, project.id);
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${project.id}`,
    data: { projectId: project.id, beforeId: null },
  });
  const totalMin = tasks.reduce((sum, t) => sum + taskEstimateSec(t) / 60, 0);

  const rename = () => {
    const name = prompt('Rename project', project.name);
    if (name === null) return;
    if (!name.trim()) {
      if (tasks.length > 0) return alert('Move or finish the tasks in this project before deleting it.');
      if (!confirm(`Delete project "${project.name}"?`)) return;
      update((d) => ({ ...d, projects: d.projects.filter((p) => p.id !== project.id) }));
      return;
    }
    update((d) => ({ ...d, projects: d.projects.map((p) => (p.id === project.id ? { ...p, name: name.trim() } : p)) }));
  };

  return (
    <section className={`column ${isOver ? 'over' : ''}`} ref={setNodeRef} style={{ ['--accent' as string]: project.color }}>
      <header>
        <button className="column-title" onClick={rename} title="Rename (clear the name to delete)">
          {project.name}
        </button>
        <span className="muted">
          {tasks.length} · {formatMinutes(Math.round(totalMin))}
        </span>
      </header>
      <div className="cards">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} color={project.color} active={t.id === active?.id} onEdit={onEdit} />
        ))}
      </div>
      <button className="add-task" onClick={() => onAddTask(project.id)}>
        + Add task
      </button>
    </section>
  );
}

function DraggableCard({ task, color, active, onEdit }: { task: Task; color: string; active: boolean; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id: task.id });
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `before-${task.id}`,
    data: { projectId: task.projectId, beforeId: task.id },
  });
  return (
    <div
      ref={(el) => {
        dragRef(el);
        dropRef(el);
      }}
      className={`card-slot ${isOver ? 'drop-before' : ''}`}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      {...attributes}
      {...listeners}
    >
      <Card task={task} color={color} active={active} onEdit={onEdit} />
    </div>
  );
}

function Card({
  task,
  color,
  active = false,
  overlay = false,
  onEdit,
}: {
  task: Task;
  color: string;
  active?: boolean;
  overlay?: boolean;
  onEdit?: (t: Task) => void;
}) {
  const { data, update } = useBoard();
  const running = data.timer?.taskId === task.id;
  const doneSubs = task.subtasks.filter((s) => s.done).length;

  const toggleTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    update((d) => (running ? stopTimer(d, Date.now()) : startTimer(d, task.id, Date.now())));
  };

  const setActive = (e: React.MouseEvent) => {
    e.stopPropagation();
    update((d) => ({
      ...d,
      projects: d.projects.map((p) => (p.id === task.projectId ? { ...p, activeTaskId: task.id } : p)),
    }));
  };

  return (
    <article
      className={`card ${active ? 'active' : ''} ${running ? 'running' : ''} ${overlay ? 'overlay' : ''}`}
      style={{ background: color }}
      onClick={() => onEdit?.(task)}
    >
      <div className="card-title">{task.title}</div>
      {task.subtasks.length > 0 && (
        <ul className="card-subs">
          {task.subtasks.slice(0, 4).map((s) => (
            <li key={s.id} className={s.done ? 'done' : ''}>
              {s.title}
            </li>
          ))}
          {task.subtasks.length > 4 && <li className="more">+{task.subtasks.length - 4} more</li>}
        </ul>
      )}
      <footer>
        <span>
          {formatMinutes(Math.round(taskEstimateSec(task) / 60))}
          {task.subtasks.length > 0 && ` · ${doneSubs}/${task.subtasks.length}`}
        </span>
        <span className="card-actions">
          {!active && (
            <button className="chip" onPointerDown={(e) => e.stopPropagation()} onClick={setActive} title="Make this the active task">
              Set active
            </button>
          )}
          <button
            className="chip"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={toggleTimer}
            aria-label={running ? 'Pause timer' : 'Start timer'}
          >
            {running ? '❚❚' : '▶'}
          </button>
          <button
            className="chip"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              update((d) => completeTask(d, task.id, Date.now()));
            }}
            aria-label="Check off task"
          >
            ✓
          </button>
        </span>
      </footer>
    </article>
  );
}
