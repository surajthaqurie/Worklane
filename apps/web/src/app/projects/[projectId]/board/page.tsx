'use client';
import { use } from 'react';
import Link from 'next/link';
import { KanbanBoard } from './Board';

export default function BoardPage(props: { params: Promise<{ projectId: string }> }) {
  const params = use(props.params);
  const { projectId } = params;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl flex flex-col gap-6 h-full min-h-screen">
      <div className="flex flex-col gap-2">
        <div className="text-sm text-gray-500 mb-2">
          <Link href={`/projects/${projectId}`} className="hover:underline">
            &larr; Back to Project
          </Link>
        </div>
        <h1 className="text-3xl font-semibold">Kanban Board</h1>
      </div>

      <div className="flex-grow">
        <KanbanBoard projectId={projectId} />
      </div>
    </div>
  );
}
