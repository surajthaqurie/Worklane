import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
  RegisterDto,
  LoginDto,
  RefreshDto,
} from './dto/auth.dto.js';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe.js';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(new ZodValidationPipe(RegisterSchema))
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UsePipes(new ZodValidationPipe(LoginSchema))
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  logout(@Body('refreshToken') refreshToken?: string) {
    return this.authService.logout(refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }
}
