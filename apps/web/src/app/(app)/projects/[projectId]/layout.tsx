import { ProjectLayoutClient } from './project-layout-client';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const resolvedParams = await params;
  
  return (
    <div className="flex h-full w-full">
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        <ProjectLayoutClient projectId={resolvedParams.projectId}>
          {children}
        </ProjectLayoutClient>
      </div>
    </div>
  );
}
