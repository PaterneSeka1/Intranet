import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Role } from '@prisma/client'

export class UpdateUserDto {
  @ApiPropertyOptional() @IsString() @IsOptional() firstName?: string
  @ApiPropertyOptional() @IsString() @IsOptional() lastName?: string
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string
  @ApiPropertyOptional({ enum: Role }) @IsEnum(Role) @IsOptional() role?: Role
  @ApiPropertyOptional() @IsString() @IsOptional() businessUnitId?: string
  @ApiPropertyOptional() @IsString() @IsOptional() poleId?: string
  @ApiPropertyOptional() @IsString() @IsOptional() managerId?: string
  @ApiPropertyOptional() @IsString() @IsOptional() scheduleGroupId?: string
  @ApiPropertyOptional({ example: '08:00' }) @IsString() @Matches(/^\d{2}:\d{2}$/) @IsOptional() individualExpectedArrivalTime?: string
  @ApiPropertyOptional() @IsString() @MinLength(8) @IsOptional() password?: string
  @ApiPropertyOptional() @IsString() @IsOptional() currentPassword?: string
}
