import { describe, expect, it, vi } from 'vitest';
import { SearchService } from './search.service.js';
import type { SearchRepository } from './search.repository.js';

describe('SearchService', () => {
  it('asserts project membership before searching a single-project scope', async () => {
    const assertProjectMember = vi.fn().mockResolvedValue({ id: 'proj-1' });
    const repo = {
      searchWorkItems: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    const service = new SearchService(repo as unknown as SearchRepository, {
      assertProjectMember,
    } as any);

    await service.searchWorkItems('user-1', { q: 'foo', projectId: 'proj-1' });

    expect(assertProjectMember).toHaveBeenCalledWith('proj-1', 'user-1');
    expect(repo.searchWorkItems).toHaveBeenCalledWith('user-1', {
      q: 'foo',
      projectId: 'proj-1',
    });
  });

  it('skips the membership check when searching globally across accessible projects', async () => {
    const assertProjectMember = vi.fn();
    const repo = {
      searchWorkItems: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    const service = new SearchService(repo as unknown as SearchRepository, {
      assertProjectMember,
    } as any);

    await service.searchWorkItems('user-1', { q: 'foo' });

    expect(assertProjectMember).not.toHaveBeenCalled();
  });
});