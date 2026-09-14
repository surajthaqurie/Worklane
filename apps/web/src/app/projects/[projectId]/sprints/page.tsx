'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSprints, useCreateSprint } from '@/hooks/useSprints';
import { format, addWeeks } from 'date-fns';

export default function SprintsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { data: sprints = [], isLoading } = useSprints(projectId);
  const createSprint = useCreateSprint(projectId);
  const [isCreating, setIsCreating] = useState(false);
  
  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const numSprints = sprints.length;
      await createSprint.mutateAsync({
        name: `Sprint ${numSprints + 1}`,
        startDate: new Date().toISOString(),
        endDate: addWeeks(new Date(), 2).toISOString(),
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) return <div className="p-8">Loading sprints...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sprints</h1>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isCreating ? 'Creating...' : '+ New Sprint'}
        </button>
      </div>
      
      <div className="flex flex-col gap-4">
        {sprints.length === 0 ? (
          <div className="text-gray-500 text-center py-12 bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
            No sprints created yet.
          </div>
        ) : (
          sprints.map((sprint: any) => (
            <Link 
              key={sprint.id} 
              href={`/projects/${projectId}/sprints/${sprint.id}`}
              className="flex flex-col gap-4 p-6 bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold flex items-center gap-3">
                    {sprint.name}
                    {sprint.state === 'ACTIVE' && (
                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                        ACTIVE
                      </span>
                    )}
                    {sprint.state === 'COMPLETED' && (
                      <span className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-full font-medium">
                        COMPLETED
                      </span>
                    )}
                  </h2>
                  <div className="text-sm text-gray-500 mt-1">
                    {format(new Date(sprint.startDate), 'MMM d')} &rarr; {format(new Date(sprint.endDate), 'MMM d')}
                  </div>
                </div>
              </div>
              
              {sprint.goal && (
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  {sprint.goal}
                </p>
              )}
              
              <div className="flex gap-4 text-sm text-gray-500 pt-4 border-t border-gray-100 dark:border-gray-900 mt-2">
                <span>{sprint.workItemsCount || 0} work items</span>
                <span>{sprint.doneWorkItemsCount || 0} done</span>
                <span>{(sprint.workItemsCount || 0) - (sprint.doneWorkItemsCount || 0)} remaining</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
