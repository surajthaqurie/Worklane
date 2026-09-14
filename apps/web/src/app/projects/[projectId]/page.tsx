'use client';
import { useState, use } from 'react';
import Link from 'next/link';
import { useWorkItems } from '@/hooks/useWorkItems';
import { useProjects } from '@/hooks/useProjects';
import { WorkItemFilters, useWorkItemFilters } from '@/components/WorkItemFilters';
import { ProjectOverview } from '@/components/ProjectOverview';

export default function ProjectDetailsPage(props: { params: Promise<{ projectId: string }> }) {
  const params = use(props.params);
  const { projectId } = params;
  
  const [activeTab, setActiveTab] = useState('overview');
  const filters = useWorkItemFilters();
  
  const { data: projects } = useProjects();
  const project = projects?.find((p: { id: string; name: string; key: string; }) => p.id === projectId);
  
  const { data: workItems, isLoading } = useWorkItems(projectId, filters);

  return (
    <div className="container mx-auto p-8 max-w-5xl flex flex-col gap-8 h-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{project?.name || 'Project Details'}</h1>
        <div className="text-sm font-mono text-gray-500">{project?.key || projectId}</div>
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6 text-sm">
        <button onClick={() => setActiveTab('overview')} className={`pb-2 ${activeTab === 'overview' ? 'border-b-2 border-black dark:border-white font-medium' : 'text-gray-500'}`}>Overview</button>
        <button onClick={() => setActiveTab('work_items')} className={`pb-2 ${activeTab === 'work_items' ? 'border-b-2 border-black dark:border-white font-medium' : 'text-gray-500'}`}>Work Items</button>
        <button onClick={() => setActiveTab('members')} className={`pb-2 ${activeTab === 'members' ? 'border-b-2 border-black dark:border-white font-medium' : 'text-gray-500'}`}>Members</button>
      </div>

      {activeTab === 'overview' && (
        <ProjectOverview projectId={projectId} />
      )}

      {activeTab === 'work_items' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-medium">Work Items</h2>
            <div className="flex gap-2">
              <Link
                href={`/projects/${projectId}/board`}
                className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 font-medium transition-colors flex items-center gap-2"
              >
                <span>📊</span> Kanban Board
              </Link>
              <Link
                href={`/projects/${projectId}/backlog`}
                className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 font-medium transition-colors flex items-center gap-2"
              >
                <span>📋</span> Backlog
              </Link>
              <Link
                href={`/projects/${projectId}/sprints`}
                className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 font-medium transition-colors flex items-center gap-2"
              >
                <span>🏃</span> Sprints
              </Link>
              <button className="bg-blue-600 text-white px-4 py-2 text-sm rounded-md hover:bg-blue-700 font-medium">
                + New Work Item
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 p-4">
            
            <WorkItemFilters />

            <div className="flex flex-col border-t border-gray-100 dark:border-gray-900 divide-y divide-gray-100 dark:divide-gray-900">
              {isLoading ? (
                <div className="py-4 text-center text-gray-500">Loading work items...</div>
              ) : workItems?.length === 0 ? (
                <div className="py-4 text-center text-gray-500">No work items found matching filters.</div>
              ) : workItems?.map((item: { id: string; key: string; title: string; type: string; priority: string; state: string; }) => (
                <div key={item.id} className="grid grid-cols-[100px_1fr_100px_100px_120px] gap-4 py-3 items-center text-sm hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer -mx-4 px-4 transition-colors">
                  <div className="font-mono text-gray-500">{item.key}</div>
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="text-gray-500">{item.type.charAt(0) + item.type.slice(1).toLowerCase()}</div>
                  <div className="text-gray-500">{item.priority.charAt(0) + item.priority.slice(1).toLowerCase()}</div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${item.state === 'TODO' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : item.state === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
                      {item.state.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
