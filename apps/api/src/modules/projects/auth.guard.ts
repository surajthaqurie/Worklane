import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    // Simplistic check: look for x-user-id header
    const userId = request.headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    // Attach user payload to request
    request.user = { id: userId };

    return true;
  }
}
