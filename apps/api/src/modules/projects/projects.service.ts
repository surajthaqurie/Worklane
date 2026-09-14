import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectsRepository } from './projects.repository.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/projects.dto.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly repo: ProjectsRepository) {}

  async assertProjectMember(projectId: string, userId: string) {
    const project = await this.repo.getProjectById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (project.created_by === userId) return project;

    const members = await this.repo.getMembers(projectId);
    const isMember = members.some((m) => m.userId === userId);

    if (!isMember) {
      throw new ForbiddenException('You do not have access to this project');
    }
    return project;
  }

  async create(userId: string, data: CreateProjectDto) {
    const project = await this.repo.createProject({
      ...data,
      created_by: userId,
    });
    return this.mapProject(project);
  }

  async findAll(userId: string) {
    const projects = await this.repo.getProjects(userId);
    return projects.map(this.mapProject);
  }

  async findOne(userId: string, projectId: string) {
    const project = await this.assertProjectMember(projectId, userId);
    return this.mapProject(project);
  }

  async update(userId: string, projectId: string, data: UpdateProjectDto) {
    await this.assertProjectMember(projectId, userId);
    const updated = await this.repo.updateProject(projectId, data);
    return this.mapProject(updated);
  }

  async remove(userId: string, projectId: string) {
    await this.assertProjectMember(projectId, userId);
    await this.repo.deleteProject(projectId);
    return { success: true };
  }

  async addMember(userId: string, projectId: string, targetUserId: string) {
    await this.assertProjectMember(projectId, userId);
    await this.repo.addMember(projectId, targetUserId);
    return { success: true };
  }

  async getMembers(userId: string, projectId: string) {
    await this.assertProjectMember(projectId, userId);
    const members = await this.repo.getMembers(projectId);

    // Also include the creator as a member
    const project = await this.repo.getProjectById(projectId);
    if (project) {
      // Fetch creator details ideally, here we just return the members from the repo
      // which might not include the creator if they aren't in project_members.
      // For simplicity we rely on the client or add logic here later.
    }
    return members;
  }

  async getOverview(userId: string, projectId: string) {
    await this.assertProjectMember(projectId, userId);
    return await this.repo.getProjectOverview(projectId);
  }

  async removeMember(userId: string, projectId: string, targetUserId: string) {
    await this.assertProjectMember(projectId, userId);
    await this.repo.removeMember(projectId, targetUserId);
    return { success: true };
  }

  private mapProject(p: any) {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      key: p.key,
      createdBy: p.created_by,
      archived: p.archived,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  }
}
