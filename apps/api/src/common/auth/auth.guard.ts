import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from './authenticated-user.js';
import { JWT_SECRET } from '../../modules/auth/auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 1. Try Authorization header: "Bearer <token>"
    const authHeader = request.headers['authorization'];
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as {
            sub: string;
          };
          if (payload && payload.sub) {
            request.user = { id: payload.sub };
            return true;
          }
        } catch {
          throw new UnauthorizedException('Invalid or expired token');
        }
      }
      throw new UnauthorizedException('Invalid authorization header format');
    }

    // 2. Fallback to x-user-id header strictly in test environment for E2E runner compatibility
    const userId = request.headers['x-user-id'];
    if (userId && process.env.NODE_ENV === 'test') {
      request.user = { id: String(userId) };
      return true;
    }

    throw new UnauthorizedException('Missing authorization token');
  }
}