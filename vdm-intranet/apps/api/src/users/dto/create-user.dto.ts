import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
} from '../../common/validators/password-complexity'

export class CreateUserDto {
  @ApiProperty({ example: 'JEAN_DUPONT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username!: string

  @ApiPropertyOptional({
    example: 'EMP-0231',
    description:
      'Identifiant de connexion (matricule). Laisser vide pour un stagiaire — il se connecte avec son email.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  matricule?: string

  @ApiProperty({ example: 'MotDePasse8+' })
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  password!: string

  @ApiPropertyOptional({ example: 'Jean' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string

  @ApiPropertyOptional({ example: 'DUPONT' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string

  @ApiProperty({
    example: 'jean@vdm.ci',
    description: 'Obligatoire pour tout le monde sans exception (identifiant de connexion des stagiaires).',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  businessUnitId?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  poleId?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  managerId?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  scheduleGroupId?: string

  @ApiPropertyOptional({ example: '08:00' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format HH:mm requis' })
  individualExpectedArrivalTime?: string

  @ApiPropertyOptional({ example: '17:00' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Format HH:mm requis' })
  individualExpectedDepartureTime?: string

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3, 4, 5],
    description:
      'Motif hebdomadaire récurrent (0=Dimanche…6=Samedi). Tableau vide = planning entièrement défini par mandats.',
  })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workingDays?: number[]
}
