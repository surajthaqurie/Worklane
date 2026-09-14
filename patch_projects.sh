#!/bin/bash
cat << 'INNER_EOF' > /tmp/projects.repository.ts.patch
--- apps/api/src/modules/projects/projects.repository.ts
+++ apps/api/src/modules/projects/projects.repository.ts
@@ -79,4 +79,53 @@
       .where('user_id', '=', userId)
       .execute();
   }
+
+  async getProjectOverview(projectId: string) {
+    const workItems = await db
+      .selectFrom('work_items')
+      .where('project_id', '=', projectId)
+      .select(['id', 'state', 'type'])
+      .execute();
+
+    const activeSprint = await db
+      .selectFrom('sprints')
+      .where('project_id', '=', projectId)
+      .where('state', '=', 'ACTIVE')
+      .selectAll()
+      .executeTakeFirst();
+
+    const recentActivity = await db
+      .selectFrom('work_item_history')
+      .innerJoin('work_items', 'work_items.id', 'work_item_history.work_item_id')
+      .innerJoin('users', 'users.id', 'work_item_history.user_id')
+      .where('work_items.project_id', '=', projectId)
+      .select([
+        'work_item_history.id',
+        'work_item_history.action',
+        'work_item_history.field',
+        'work_item_history.old_value',
+        'work_item_history.new_value',
+        'work_item_history.created_at',
+        'work_items.key as work_item_key',
+        'work_items.title as work_item_title',
+        'users.name as user_name',
+      ])
+      .orderBy('work_item_history.created_at', 'desc')
+      .limit(10)
+      .execute();
+
+    let activeSprintStats = null;
+    if (activeSprint) {
+      const sprintItems = await db
+        .selectFrom('work_items')
+        .where('sprint_id', '=', activeSprint.id)
+        .select(['id', 'state'])
+        .execute();
+      
+      const completed = sprintItems.filter(i => i.state === 'DONE').length;
+      const total = sprintItems.length;
+      
+      activeSprintStats = {
+        ...activeSprint,
+        completedItems: completed,
+        remainingItems: total - completed,
+        totalItems: total,
+        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
+      };
+    }
+
+    const stats = {
+      total: workItems.length,
+      todo: workItems.filter(i => i.state === 'TODO').length,
+      inProgress: workItems.filter(i => i.state === 'IN_PROGRESS').length,
+      done: workItems.filter(i => i.state === 'DONE').length,
+      bugs: workItems.filter(i => i.type === 'BUG').length,
+    };
+
+    return {
+      stats,
+      activeSprint: activeSprintStats,
+      recentActivity,
+    };
+  }
 }
INNER_EOF
patch apps/api/src/modules/projects/projects.repository.ts < /tmp/projects.repository.ts.patch
