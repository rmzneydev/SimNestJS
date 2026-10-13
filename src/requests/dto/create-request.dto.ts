import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

const normalizeSpaces = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;

export class CreateRequestDto {
  @ApiProperty({ example: 'Comercial Andina S.A.S.' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'cliente no puede contener solo espacios' })
  @Transform(normalizeSpaces)
  cliente: string;

  @ApiProperty({ example: 'Solicita cotización de renovación' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'descripcion no puede contener solo espacios' })
  @Transform(normalizeSpaces)
  descripcion: string;
}
