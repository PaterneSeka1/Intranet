import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import {
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
} from '../../common/validators/password-complexity'

export class UpdateUserDto {
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) firstName?: string
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(100) lastName?: string
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string
  @ApiPropertyOptional({
    example: 'EMP-0231',
    description:
      'Identifiant de connexion (matricule). Laisser vide pour un stagiaire — il se connecte avec son email.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  matricule?: string
  @ApiPropertyOptional({ enum: Role }) @IsEnum(Role) @IsOptional() role?: Role
  @ApiPropertyOptional() @IsString() @IsOptional() businessUnitId?: string
  @ApiPropertyOptional() @IsString() @IsOptional() poleId?: string
  @ApiPropertyOptional() @IsString() @IsOptional() managerId?: string
  @ApiPropertyOptional() @IsString() @IsOptional() scheduleGroupId?: string
  @ApiPropertyOptional({ example: '08:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  @IsOptional()
  individualExpectedArrivalTime?: string
  @ApiPropertyOptional({ example: '17:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  @IsOptional()
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
  @ApiPropertyOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  @IsOptional()
  password?: string
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) currentPassword?: string
}
