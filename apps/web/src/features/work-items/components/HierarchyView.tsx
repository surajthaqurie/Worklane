'use client';

import React from 'react';
import { HierarchyNode, WorkItemHierarchyResponse } from '@/shared/types/work-items';
import { WorkItemTypeBadge } from './WorkItemBadge';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Layers, ChevronRight, CheckCircle2, Clock, Hash, Percent } from 'lucide-react';

interface HierarchyViewProps {
  hierarchy: WorkItemHierarchyResponse | undefined;
  isLoading: boolean;
  onSelectWorkItem?: (id: string) => void;
}

function TreeNode({ node, onSelect }: { node: HierarchyNode; onSelect?: (id: string) => void }) {
  const rollup = node.rollup;
  const hasRollupData = rollup && rollup.descendantCount > 0;

  return (
    <div className="ml-4 border-l-2 border-slate-200 dark:border-slate-800 pl-4 my-2">
      <div
        onClick={() => onSelect?.(node.id)}
        className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <WorkItemTypeBadge type={node.type} />
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">#{node.id.slice(0, 8)}</span>
          <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            {node.title}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
            {node.state}
          </span>
        </div>

        {hasRollupData && (
          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-mono">
            <span className="flex items-center gap-1" title="Descendant items">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              {rollup.completedCount}/{rollup.descendantCount}
            </span>
            {rollup.totalPoints > 0 && (
              <span className="flex items-center gap-1" title="Story Points Rollup">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                {rollup.completedPoints}/{rollup.totalPoints} pts
              </span>
            )}
            <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${rollup.completionPercentage}%` }}
              />
            </div>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 min-w-[32px] text-right">
              {rollup.completionPercentage}%
            </span>
          </div>
        )}
      </div>

      {node.children && node.children.length > 0 && (
        <div className="mt-1">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export function HierarchyView({ hierarchy, isLoading, onSelectWorkItem }: HierarchyViewProps) {
  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-500">
        <Spinner className="w-6 h-6 mr-2" />
        <span>Loading hierarchy and rollup calculations...</span>
      </div>
    );
  }

  if (!hierarchy) {
    return (
      <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
        No hierarchy data available.
      </div>
    );
  }

  const { item, ancestors, rollup } = hierarchy;

  return (
    <div className="space-y-4">
      {/* Ancestor Breadcrumb Path */}
      {ancestors.length > 0 && (
        <div className="flex items-center flex-wrap gap-1 text-xs text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-800">
          <span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">Ancestors:</span>
          {ancestors.map((anc, i) => (
            <React.Fragment key={anc.id}>
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
              <button
                onClick={() => onSelectWorkItem?.(anc.id)}
                className="hover:underline hover:text-indigo-600 font-mono"
              >
                [{anc.type}] {anc.title}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Target Item Rollup Header Card */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/50 to-slate-50 dark:from-indigo-950/20 dark:to-slate-900/50 border border-indigo-100 dark:border-indigo-900/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <WorkItemTypeBadge type={item.type} />
              <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">{item.title}</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Rollup Engine Metrics across full descendant tree
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="text-center">
              <div className="text-slate-400">Descendants</div>
              <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {rollup.completedCount} / {rollup.descendantCount}
              </div>
            </div>

            {rollup.totalPoints > 0 && (
              <div className="text-center">
                <div className="text-slate-400">Story Points</div>
                <div className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                  {rollup.completedPoints} / {rollup.totalPoints}
                </div>
              </div>
            )}

            {(rollup.remainingWork > 0 || rollup.completedWork > 0) && (
              <div className="text-center">
                <div className="text-slate-400">Work Hours</div>
                <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  {rollup.completedWork}h / {(rollup.completedWork + rollup.remainingWork)}h
                </div>
              </div>
            )}

            <div className="text-center pl-2 border-l border-slate-300 dark:border-slate-700">
              <div className="text-slate-400">Completion</div>
              <div className="font-extrabold text-base text-indigo-600 dark:text-indigo-400">
                {rollup.completionPercentage}%
              </div>
            </div>
          </div>
        </div>

        {/* Big Progress bar */}
        <div className="mt-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${rollup.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Tree Node Structure */}
      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Hierarchy Tree ({item.children.length} direct children)
        </h4>

        {item.children.length === 0 ? (
          <div className="text-xs text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
            No child work items assigned yet.
          </div>
        ) : (
          item.children.map((child) => (
            <TreeNode key={child.id} node={child} onSelect={onSelectWorkItem} />
          ))
        )}
      </div>
    </div>
  );
}
