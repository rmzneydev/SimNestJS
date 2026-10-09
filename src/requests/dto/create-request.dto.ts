import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRequestDto {
  @ApiProperty({ example: 'Comercial Andina S.A.S.' })
  @IsString()
  @IsNotEmpty()
  cliente: string;

  @ApiProperty({ example: 'Solicita cotización de renovación' })
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @ApiPropertyOptional({
    example: 'Ana',
    description: 'Obligatorio si registra un admin o supervisor; se ignora si registra un asesor',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  asesor?: string;
}
