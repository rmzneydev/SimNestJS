import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({
    example: 'EN_GESTION',
    description: 'Nombre de un estado existente en la tabla estados',
  })
  @IsString()
  @IsNotEmpty()
  estado: string;
}
