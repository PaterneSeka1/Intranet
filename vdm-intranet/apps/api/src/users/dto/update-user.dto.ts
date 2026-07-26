import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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
  @ApiPropertyOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  @IsOptional()
  password?: string
  @ApiPropertyOptional() @IsString() @IsOptional() @MaxLength(200) currentPassword?: string
}
