import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from './kysely.js';

async function seed() {
  console.log('Seeding default admin user and project memberships...');
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@worklane.dev';
  const password = process.env.SEED_ADMIN_PASSWORD || 'WorklaneAdmin2026!';
  const name = process.env.SEED_ADMIN_NAME || 'Admin User';

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn('⚠️ WARNING: SEED_ADMIN_PASSWORD environment variable not set. Using default initial password.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let adminUser = await db
    .selectFrom('users')
    .where('email', '=', email)
    .select(['id', 'email', 'name'])
    .executeTakeFirst();

  if (adminUser) {
    await db
      .updateTable('users')
      .set({
        password_hash: passwordHash,
        name: name,
      })
      .where('id', '=', adminUser.id)
      .execute();
    console.log(`Updated existing admin user (${email}).`);
  } else {
    adminUser = await db
      .insertInto('users')
      .values({
        name,
        email,
        password_hash: passwordHash,
      })
      .returning(['id', 'email', 'name'])
      .executeTakeFirstOrThrow();
    console.log(`Created admin user: ${adminUser.email} (ID: ${adminUser.id})`);
  }

  // Get all existing projects
  const allProjects = await db
    .selectFrom('projects')
    .select(['id', 'name', 'key'])
    .execute();

  if (allProjects.length === 0) {
    // Create a default project for admin if no projects exist
    const newProj = await db
      .insertInto('projects')
      .values({
        name: 'Demo Project',
        key: 'DEMO',
        description: 'Default demo workspace for managing tasks and boards.',
        created_by: adminUser.id,
        organization_id: '00000000-0000-0000-0000-000000000000',
      })
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow();

    await db
      .insertInto('project_members')
      .values({
        project_id: newProj.id,
        user_id: adminUser.id,
        role: 'OWNER',
      })
      .execute();

    console.log(`Created default project "${newProj.name}" for admin.`);
  } else {
    // Ensure admin user is an OWNER member of ALL existing projects
    for (const proj of allProjects) {
      const existingMember = await db
        .selectFrom('project_members')
        .where('project_id', '=', proj.id)
        .where('user_id', '=', adminUser.id)
        .select(['id'])
        .executeTakeFirst();

      if (!existingMember) {
        await db
          .insertInto('project_members')
          .values({
            project_id: proj.id,
            user_id: adminUser.id,
            role: 'OWNER',
          })
          .execute();
        console.log(`Added admin user as OWNER to project "${proj.name}" (${proj.key}).`);
      }
    }
  }

  console.log('Seeding completed successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
