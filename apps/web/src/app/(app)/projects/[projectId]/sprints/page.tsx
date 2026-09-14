export default async function SprintsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = await params;
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Sprints</h1>
    </div>
  );
}
