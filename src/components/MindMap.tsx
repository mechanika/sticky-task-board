import { useBoard } from '../store';
import { activeTask, formatMinutes, openTasks, sortedProjects, taskEstimateSec } from '../logic';
import type { Task } from '../types';

const ROW = 34;
const COL = [0, 170, 400, 650];
const NODE_W = [120, 190, 210, 190];

interface Node {
  key: string;
  depth: number;
  y: number;
  label: string;
  sub?: string;
  color: string;
  parent?: Node;
  task?: Task;
  done?: boolean;
  active?: boolean;
}

/** Overview tree: board → projects → tasks → sub-tasks, laid out left to right. */
export function MindMap({ onEdit }: { onEdit: (t: Task) => void }) {
  const { data } = useBoard();
  const nodes: Node[] = [];
  let row = 0;

  const root: Node = { key: 'root', depth: 0, y: 0, label: 'My tasks', color: '#e8e6e3' };
  nodes.push(root);
  const projectNodes: Node[] = [];

  for (const p of sortedProjects(data)) {
    const tasks = openTasks(data, p.id);
    const active = activeTask(data, p.id);
    const startRow = row;
    const pNode: Node = { key: p.id, depth: 1, y: 0, label: p.name, sub: `${tasks.length} open`, color: p.color, parent: root };
    nodes.push(pNode);
    projectNodes.push(pNode);
    if (tasks.length === 0) row++;
    for (const t of tasks) {
      const tStart = row;
      const tNode: Node = {
        key: t.id,
        depth: 2,
        y: 0,
        label: (t.message ? '💬 ' : '') + t.title,
        sub: formatMinutes(Math.round(taskEstimateSec(t) / 60)),
        color: p.color,
        parent: pNode,
        task: t,
        active: t.id === active?.id,
      };
      nodes.push(tNode);
      if (t.subtasks.length === 0) row++;
      for (const s of t.subtasks) {
        nodes.push({
          key: s.id,
          depth: 3,
          y: row++ * ROW,
          label: s.title,
          sub: formatMinutes(s.estimateMin),
          color: p.color,
          parent: tNode,
          task: t,
          done: s.done,
        });
      }
      tNode.y = ((tStart + row - 1) / 2) * ROW;
    }
    pNode.y = ((startRow + row - 1) / 2) * ROW;
    row += 0.5;
  }
  root.y = projectNodes.length ? (projectNodes[0].y + projectNodes[projectNodes.length - 1].y) / 2 : 0;

  const pad = 24;
  const height = Math.max(row * ROW, ROW) + pad * 2;
  const width = COL[3] + NODE_W[3] + pad * 2;

  return (
    <div className="mindmap">
      <svg width={width} height={height} viewBox={`${-pad} ${-pad} ${width} ${height}`}>
        {nodes
          .filter((n) => n.parent)
          .map((n) => {
            const p = n.parent!;
            const x1 = COL[p.depth] + NODE_W[p.depth];
            const x2 = COL[n.depth];
            const y1 = p.y + ROW / 2 - 4;
            const y2 = n.y + ROW / 2 - 4;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={`e-${n.key}`}
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                className="edge"
                stroke={n.color}
              />
            );
          })}
        {nodes.map((n) => (
          <g
            key={n.key}
            transform={`translate(${COL[n.depth]},${n.y})`}
            className={`node d${n.depth} ${n.done ? 'done' : ''} ${n.active ? 'active' : ''} ${n.task ? 'clickable' : ''}`}
            onClick={() => n.task && onEdit(n.task)}
          >
            <rect width={NODE_W[n.depth]} height={ROW - 8} rx={8} fill={n.color} />
            <text x={10} y={(ROW - 8) / 2 + 5}>
              {truncate(n.label, n.depth === 0 ? 14 : 22)}
            </text>
            {n.sub && (
              <text x={NODE_W[n.depth] - 8} y={(ROW - 8) / 2 + 5} textAnchor="end" className="node-sub">
                {n.sub}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
