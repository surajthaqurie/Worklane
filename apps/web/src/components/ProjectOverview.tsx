import { useProjectOverview } from '@/hooks/useProjects';
import { format } from 'date-fns';

export function ProjectOverview({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useProjectOverview(projectId);

  if (isLoading) return <div className="py-8 text-gray-500">Loading overview...</div>;
  if (error) return <div className="py-8 text-red-500">Failed to load overview</div>;
  if (!data) return null;

  const { stats, activeSprint, recentActivity } = data;
  
  const total = stats.total || 1; // avoid div by 0
  const todoPct = (stats.todo / total) * 100;
  const inProgPct = (stats.inProgress / total) * 100;
  const donePct = (stats.done / total) * 100;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Project Overview Stats */}
        <div className="flex flex-col gap-4 border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-950 shadow-sm">
          <h2 className="text-xl font-medium mb-2">Project Overview</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-sm text-gray-500">Total Work Items</span>
              <span className="text-2xl font-semibold">{stats.total}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500">Bugs</span>
              <span className="text-2xl font-semibold">{stats.bugs}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500">To Do</span>
              <span className="text-2xl font-semibold">{stats.todo}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500">In Progress</span>
              <span className="text-2xl font-semibold">{stats.inProgress}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500">Done</span>
              <span className="text-2xl font-semibold">{stats.done}</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-medium mb-2">Work Distribution</h3>
            <div className="flex h-4 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              {stats.todo > 0 && <div style={{ width: `${todoPct}%` }} className="bg-gray-300 dark:bg-gray-600" title={`To Do: ${stats.todo}`}></div>}
              {stats.inProgress > 0 && <div style={{ width: `${inProgPct}%` }} className="bg-blue-500" title={`In Progress: ${stats.inProgress}`}></div>}
              {stats.done > 0 && <div style={{ width: `${donePct}%` }} className="bg-green-500" title={`Done: ${stats.done}`}></div>}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></div>To Do</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>In Progress</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>Done</div>
            </div>
          </div>
        </div>

        {/* Current Sprint */}
        <div className="flex flex-col gap-4 border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-950 shadow-sm">
          <h2 className="text-xl font-medium mb-2">Current Sprint</h2>
          {activeSprint ? (
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-lg font-medium">{activeSprint.name}</div>
                <div className="text-sm text-gray-500">
                  {format(new Date(activeSprint.start_date), 'MMM d, yyyy')} - {format(new Date(activeSprint.end_date), 'MMM d, yyyy')}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500">Completed Items</span>
                  <span className="text-2xl font-semibold text-green-600 dark:text-green-500">{activeSprint.completedItems}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500">Remaining Items</span>
                  <span className="text-2xl font-semibold">{activeSprint.remainingItems}</span>
                </div>
              </div>
              
              <div className="mt-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>Sprint Progress</span>
                  <span className="font-medium">{activeSprint.progress}%</span>
                </div>
                <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <div style={{ width: `${activeSprint.progress}%` }} className="bg-green-500"></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 flex items-center justify-center h-full pb-8">
              No active sprint right now.
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="flex flex-col gap-4 border border-gray-200 dark:border-gray-800 rounded-lg p-6 bg-white dark:bg-gray-950 shadow-sm">
        <h2 className="text-xl font-medium mb-4">Recent Activity</h2>
        {recentActivity && recentActivity.length > 0 ? (
          <div className="flex flex-col gap-4 divide-y divide-gray-100 dark:divide-gray-900">
            {recentActivity.map((activity: any) => (
              <div key={activity.id} className="pt-4 flex flex-col gap-1 first:pt-0">
                <div className="text-sm">
                  <span className="font-medium">{activity.user_name}</span>
                  {' '}
                  <span className="text-gray-500">
                    {activity.action === 'CREATED' ? 'created' : 'updated'}
                  </span>
                  {' '}
                  <span className="font-medium">#{activity.work_item_seq}</span>: {activity.work_item_title}
                </div>
                {activity.field && (
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{activity.field}</span>
                    <span>changed from</span>
                    <span className="font-medium">{activity.old_value || 'None'}</span>
                    <span>to</span>
                    <span className="font-medium">{activity.new_value || 'None'}</span>
                  </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 pb-4">No recent activity.</div>
        )}
      </div>
    </div>
  );
}
