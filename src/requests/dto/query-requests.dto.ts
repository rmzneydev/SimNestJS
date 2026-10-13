import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  registerDecorator,
} from 'class-validator';
import type { ValidationArguments, ValidationOptions } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

function IsDateRangeValid(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDateRangeValid',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const desde = (args.object as QueryRequestsDto).desde;
          if (!desde || !value) return true;
          return new Date(desde).getTime() <= new Date(value as string).getTime();
        },
        defaultMessage() {
          return 'desde no puede ser posterior a hasta';
        },
      },
    });
  };
}

export class QueryRequestsDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Filtra por el nombre de un estado existente en la tabla estados',
  })
  @IsOptional()
  @IsString()
  @Transform(trim)
  estado?: string;

  @ApiPropertyOptional({
    example: 'ana',
    description: 'Filtra por el identificador del asesor asignado',
  })
  @IsOptional()
  @IsString()
  @Transform(trim)
  asesor?: string;

  @ApiPropertyOptional({
    example: 'norte',
    description: 'Búsqueda parcial de cliente, sin distinguir mayúsculas de minúsculas',
  })
  @IsOptional()
  @IsString()
  @Transform(trim)
  cliente?: string;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00Z',
    description: 'Fecha mínima (inclusive) de creadaEn, formato ISO 8601',
  })
  @IsOptional()
  @IsISO8601()
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-10-31T23:59:59Z',
    description: 'Fecha máxima (inclusive) de creadaEn, formato ISO 8601',
  })
  @IsOptional()
  @IsISO8601()
  @IsDateRangeValid()
  hasta?: string;

  @ApiPropertyOptional({ default: 1, example: 1, description: 'Página, mínima 1' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    default: 10,
    example: 10,
    description: 'Elementos por página, entre 1 y 100',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
