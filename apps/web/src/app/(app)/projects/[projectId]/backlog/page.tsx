export default async function BacklogPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = await params;
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Backlog</h1>
    </div>
  );
}
