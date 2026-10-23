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
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Project, Task } from '../types';
import { useBoard } from '../store';
import { MessageIcon } from './MessageIcon';
import {
  COLORS,
  activeTask,
  completeTask,
  formatMinutes,
  moveProject,
  moveTask,
  openTasks,
  sortedProjects,
  startTimer,
  stopTimer,
  taskEstimateSec,
  uid,
} from '../logic';

// Columns drop where the pointer is, onto column targets only; tasks keep the default.
const collision: CollisionDetection = (args) => {
  if (!args.active.data.current?.projectDrag) return rectIntersection(args);
  return pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith('col-')),
  });
};

interface Props {
  onEdit: (task: Task) => void;
  onAddTask: (projectId: string) => void;
}

export function Board({ onEdit, onAddTask }: Props) {
  const { data, update } = useBoard();
  const [dragging, setDragging] = useState<Task | null>(null);
  const [draggingProject, setDraggingProject] = useState<Project | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const projectId = e.active.data.current?.projectDrag as string | undefined;
    if (projectId) setDraggingProject(data.projects.find((p) => p.id === projectId) ?? null);
    else setDragging(data.tasks.find((t) => t.id === e.active.id) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    setDraggingProject(null);
    const over = e.over?.data.current as { projectId: string; beforeId: string | null } | undefined;
    if (!over) return;
    const projectId = e.active.data.current?.projectDrag as string | undefined;
    if (projectId) update((d) => moveProject(d, projectId, over.projectId));
    else update((d) => moveTask(d, String(e.active.id), over.projectId, over.beforeId));
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
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setDraggingProject(null);
      }}
    >
      <div className="board">
        {sortedProjects(data).map((p) => (
          <Column key={p.id} project={p} onEdit={onEdit} onAddTask={onAddTask} />
        ))}
        <button className="add-column" onClick={addProject}>
          + Project
        </button>
      </div>
      <DragOverlay>
        {dragging && <Card task={dragging} color={colorOf(dragging)} overlay />}
        {draggingProject && (
          <div className="column column-ghost" style={{ ['--accent' as string]: draggingProject.color }}>
            <header>
              <span className="column-title">{draggingProject.name}</span>
            </header>
          </div>
        )}
      </DragOverlay>
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
  const {
    attributes,
    listeners,
    setNodeRef: handleRef,
    isDragging,
  } = useDraggable({ id: `proj-${project.id}`, data: { projectDrag: project.id } });
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
    <section
      className={`column ${isOver ? 'over' : ''}`}
      ref={setNodeRef}
      style={{ ['--accent' as string]: project.color, opacity: isDragging ? 0.4 : 1 }}
    >
      <header>
        <span className="column-grip" ref={handleRef} {...attributes} {...listeners} aria-label={`Drag to reorder ${project.name}`}>
          ⠿
        </span>
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
  const { setNodeRef: dropRef, isOver, active: dragActive } = useDroppable({
    id: `before-${task.id}`,
    data: { projectId: task.projectId, beforeId: task.id },
  });
  const projectDrag = !!dragActive?.data.current?.projectDrag;
  return (
    <div
      ref={(el) => {
        dragRef(el);
        dropRef(el);
      }}
      className={`card-slot ${isOver && !projectDrag ? 'drop-before' : ''}`}
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
      className={`card ${active ? 'active' : ''} ${running ? 'running' : ''} ${overlay ? 'overlay' : ''} ${task.message ? 'message' : ''}`}
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
          <button
            className={`chip msg-toggle ${task.message ? 'on' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, message: !t.message } : t)) }));
            }}
            aria-label={task.message ? 'Unmark as message task' : 'Mark as message task'}
            aria-pressed={!!task.message}
            title="Message / communication task"
          >
            <MessageIcon filled={task.message} />
          </button>
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
