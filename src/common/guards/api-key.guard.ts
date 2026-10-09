import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const apiKey = context.switchToHttp().getRequest().headers['x-api-key'];
    const validKeys = (this.config.get<string>('API_KEYS') ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    if (typeof apiKey !== 'string' || !validKeys.includes(apiKey)) {
      throw new UnauthorizedException('API Key ausente o inválida');
    }
    return true;
  }
}
