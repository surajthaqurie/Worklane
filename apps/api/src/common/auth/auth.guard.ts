import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from './authenticated-user.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-worklane-access-key-2026';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 1. Try Authorization header: "Bearer <token>"
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
        if (payload && payload.sub) {
          request.user = { id: payload.sub };
          return true;
        }
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
    }

    // 2. Fallback to x-user-id header (for backward compatibility / direct API calls)
    const userId = request.headers['x-user-id'];
    if (userId) {
      request.user = { id: String(userId) };
      return true;
    }

    throw new UnauthorizedException('Missing authorization token or x-user-id header');
  }
}