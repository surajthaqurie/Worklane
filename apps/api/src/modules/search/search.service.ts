import { Injectable } from '@nestjs/common';
import { SearchRepository } from './search.repository.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { GlobalSearchDto } from './dto/search.dto.js';

@Injectable()
export class SearchService {
  constructor(
    private readonly repo: SearchRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async searchWorkItems(userId: string, filters: GlobalSearchDto) {
    // When scoping to a single project, fail the request entirely if the user
    // cannot access it so an unauthorized scope can never silently match.
    if (filters.projectId) {
      await this.projectsService.assertProjectMember(filters.projectId, userId);
    }
    return this.repo.searchWorkItems(userId, filters);
  }
}