import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AssignRequestDto {
  @ApiProperty({
    example: 'ana',
    description: 'Usuario existente con rol asesor al que se asigna o reasigna la solicitud',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(trim)
  asesorId: string;
}
