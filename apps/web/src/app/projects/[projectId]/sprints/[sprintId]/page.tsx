'use client';
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSprint, useUpdateSprint } from '@/hooks/useSprints';
import { KanbanBoard } from '../../board/Board';
import { format } from 'date-fns';
import Link from 'next/link';

export default function SprintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const sprintId = params.sprintId as string;
  
  const { data: sprint, isLoading } = useSprint(projectId, sprintId);
  const updateSprint = useUpdateSprint(projectId);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', goal: '' });

  if (isLoading) return <div className="p-8">Loading sprint...</div>;
  if (!sprint) return <div className="p-8 text-red-500">Sprint not found</div>;

  const handleStartEdit = () => {
    setEditData({ name: sprint.name, goal: sprint.goal || '' });
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateSprint.mutateAsync({
      id: sprintId,
      data: editData
    });
    setIsEditing(false);
  };

  const handleStateChange = async (newState: string) => {
    try {
      await updateSprint.mutateAsync({
        id: sprintId,
        data: { state: newState }
      });
    } catch (e) {
      alert('Failed to update state. Only one active sprint is allowed per project.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="flex-shrink-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 p-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
              <Link href={`/projects/${projectId}/sprints`} className="text-gray-500 hover:text-gray-700">&larr; Back</Link>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input 
                    className="border px-2 py-1 rounded dark:bg-gray-800 dark:border-gray-700" 
                    value={editData.name} 
                    onChange={e => setEditData({...editData, name: e.target.value})} 
                  />
                  <button onClick={handleSave} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Save</button>
                  <button onClick={() => setIsEditing(false)} className="bg-gray-200 text-gray-800 px-3 py-1 rounded text-sm">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{sprint.name}</h1>
                  <button onClick={handleStartEdit} className="text-gray-400 hover:text-gray-600">✎</button>
                  {sprint.state === 'ACTIVE' && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">ACTIVE</span>
                  )}
                  {sprint.state === 'COMPLETED' && (
                    <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full font-medium">COMPLETED</span>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              {sprint.state === 'PLANNED' && (
                <button onClick={() => handleStateChange('ACTIVE')} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium">
                  Start Sprint
                </button>
              )}
              {sprint.state === 'ACTIVE' && (
                <button onClick={() => handleStateChange('COMPLETED')} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium">
                  Complete Sprint
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-8 text-sm">
            <div className="text-gray-500">
              {format(new Date(sprint.startDate), 'MMM d, yyyy')} &rarr; {format(new Date(sprint.endDate), 'MMM d, yyyy')}
            </div>
            {isEditing ? (
              <input 
                placeholder="Sprint Goal"
                className="border px-2 py-1 rounded w-64 dark:bg-gray-800 dark:border-gray-700" 
                value={editData.goal} 
                onChange={e => setEditData({...editData, goal: e.target.value})} 
              />
            ) : (
              <div className="text-gray-700 dark:text-gray-300">
                <span className="font-medium mr-2">Goal:</span> 
                {sprint.goal || <span className="text-gray-400 italic">No goal set</span>}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-grow p-6 overflow-hidden">
        <div className="max-w-[1400px] mx-auto h-full">
          <KanbanBoard projectId={projectId} sprintId={sprintId} />
        </div>
      </div>
    </div>
  );
}
