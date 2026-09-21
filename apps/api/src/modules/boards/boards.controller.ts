import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BoardsService } from './boards.service.js';
import { CreateBoardDto, UpdateBoardDto, MoveWorkItemDto } from './dto/boards.dto.js';
import { AuthGuard } from '../../common/auth/auth.guard.js';

@Controller('projects/:projectId/boards')
@UseGuards(AuthGuard)
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get()
  listBoards(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.boardsService.listBoards(req.user.id, projectId, teamId);
  }

  @Get(':boardId')
  getBoard(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('boardId') boardId: string,
  ) {
    return this.boardsService.getBoard(req.user.id, projectId, boardId);
  }

  @Post()
  createBoard(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() dto: CreateBoardDto,
  ) {
    return this.boardsService.createBoard(req.user.id, projectId, dto);
  }

  @Patch(':boardId')
  updateBoard(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('boardId') boardId: string,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boardsService.updateBoard(req.user.id, projectId, boardId, dto);
  }

  @Delete(':boardId')
  deleteBoard(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('boardId') boardId: string,
  ) {
    return this.boardsService.deleteBoard(req.user.id, projectId, boardId);
  }

  @Get(':boardId/work-items')
  getBoardWorkItems(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('boardId') boardId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.boardsService.getBoardWorkItems(req.user.id, projectId, boardId, query);
  }

  @Post(':boardId/work-items/:workItemId/move')
  moveWorkItem(
    @Req() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Param('boardId') boardId: string,
    @Param('workItemId') workItemId: string,
    @Body() dto: MoveWorkItemDto,
  ) {
    return this.boardsService.moveWorkItem(req.user.id, projectId, boardId, workItemId, dto);
  }
}
