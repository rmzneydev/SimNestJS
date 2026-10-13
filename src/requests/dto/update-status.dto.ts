import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({
    example: 'EN_GESTION',
    description: 'Nombre de un estado existente en la tabla estados',
  })
  @IsString()
  @IsNotEmpty()
  estado: string;

  @ApiProperty({
    example: 1,
    description:
      'Versión de la solicitud que el cliente consultó. Si no coincide con la persistida, la API responde 409',
  })
  @IsInt()
  @Min(1)
  versionEsperada: number;
}
