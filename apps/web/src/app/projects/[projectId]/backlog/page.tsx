import { BacklogBoard } from './Backlog';

export default async function BacklogPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;

  return (
    <div className="flex-1 overflow-hidden h-full">
      <BacklogBoard projectId={projectId} />
    </div>
  );
}
