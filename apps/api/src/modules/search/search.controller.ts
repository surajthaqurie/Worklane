import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import type { GlobalSearchDto } from './dto/search.dto.js';

@Controller()
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('search/work-items')
  searchWorkItems(
    @Req() req: { user: { id: string } },
    @Query() query: GlobalSearchDto,
  ) {
    return this.searchService.searchWorkItems(req.user.id, query);
  }
}