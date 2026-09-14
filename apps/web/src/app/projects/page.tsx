'use client';



// NOTE: In a real app we'd wrap with QueryClientProvider and use useProjects()
// but for simplicity we'll just mock the visual presentation here.

export default function ProjectsPage() {
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          + New Project
        </button>
      </div>

      <div className="grid gap-4">
        {/* Example card, would map over useProjects data */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:border-gray-300 transition-colors bg-white dark:bg-gray-950">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-lg font-medium">Fitness Platform</h2>
            <span className="text-sm font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">APP</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Fitness application backend and mobile app
          </p>
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="text-lg">👥</span> 4 members
            </div>
            <span>Sep 13</span>
          </div>
        </div>
      </div>
    </div>
  );
}
