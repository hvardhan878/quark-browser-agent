import { CheckCircle, Circle, Loader2, AlertCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { AgentTask, AgentTaskStatus } from '../../shared/types';

interface AgentTaskListProps {
  tasks: AgentTask[];
  currentTaskId?: string;
}

export function AgentTaskList({ tasks, currentTaskId }: AgentTaskListProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  if (tasks.length === 0) {
    return null;
  }

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  return (
    <div className="bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      <div className="px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          Agent Tasks
        </h3>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            isActive={task.id === currentTaskId}
            isExpanded={expandedTasks.has(task.id)}
            onToggleExpand={() => toggleExpand(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface TaskItemProps {
  task: AgentTask;
  isActive: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function TaskItem({ task, isActive, isExpanded, onToggleExpand }: TaskItemProps) {
  const hasDetails = task.result || task.error || task.toolParams;

  return (
    <div className={`${isActive ? 'bg-[var(--accent-primary)]/5' : ''}`}>
      <div 
        className={`flex items-start gap-2 px-3 py-2 ${hasDetails ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : ''}`}
        onClick={hasDetails ? onToggleExpand : undefined}
      >
        <div className="flex-shrink-0 mt-0.5">
          <TaskStatusIcon status={task.status} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {hasDetails && (
              <span className="flex-shrink-0 text-[var(--text-muted)]">
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            )}
            <p className={`text-sm ${
              task.status === 'failed' 
                ? 'text-red-400' 
                : task.status === 'completed'
                  ? 'text-[var(--text-secondary)]'
                  : 'text-[var(--text-primary)]'
            }`}>
              {task.description}
            </p>
          </div>
          
          {task.toolName && task.status !== 'completed' && (
            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-muted)] text-xs rounded">
              {task.toolName}
            </span>
          )}
        </div>
      </div>
      
      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div className="px-3 pb-2 pl-8">
          {task.toolParams && Object.keys(task.toolParams).length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-[var(--text-muted)] mb-1">Parameters:</p>
              <pre className="text-xs bg-[var(--bg-primary)] p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                {JSON.stringify(task.toolParams, null, 2)}
              </pre>
            </div>
          )}
          
          {task.result !== undefined && task.result !== null && (
            <div className="mb-2">
              <p className="text-xs text-[var(--text-muted)] mb-1">Result:</p>
              <pre className="text-xs bg-[var(--bg-primary)] p-2 rounded overflow-x-auto max-h-32 overflow-y-auto text-green-400">
                {typeof task.result === 'string' 
                  ? task.result 
                  : JSON.stringify(task.result as object, null, 2)}
              </pre>
            </div>
          )}
          
          {task.error && (
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">Error:</p>
              <pre className="text-xs bg-red-500/10 p-2 rounded overflow-x-auto text-red-400">
                {task.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskStatusIcon({ status }: { status: AgentTaskStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle size={16} className="text-green-500" />;
    case 'in_progress':
      return <Loader2 size={16} className="text-[var(--accent-primary)] animate-spin" />;
    case 'failed':
      return <AlertCircle size={16} className="text-red-500" />;
    case 'awaiting_permission':
      return <Clock size={16} className="text-orange-400" />;
    case 'pending':
    default:
      return <Circle size={16} className="text-[var(--text-muted)]" />;
  }
}

