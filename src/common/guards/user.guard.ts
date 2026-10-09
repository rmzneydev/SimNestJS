import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { USERS } from '../users.js';

@Injectable()
export class UserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const username = request.headers['x-user'];
    if (typeof username !== 'string' || !Object.hasOwn(USERS, username)) {
      throw new UnauthorizedException('Usuario ausente o no reconocido');
    }
    request.user = { username, role: USERS[username] };
    return true;
  }
}
