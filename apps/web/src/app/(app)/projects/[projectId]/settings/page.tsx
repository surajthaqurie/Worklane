export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const resolvedParams = await params;
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
    </div>
  );
}
