import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Role } from '@prisma/client'

export class CreateUserDto {
  @ApiProperty({ example: 'JEAN_DUPONT' })
  @IsString() @IsNotEmpty()
  username!: string

  @ApiProperty({ example: 'MotDePasse8+' })
  @IsString() @MinLength(8)
  password!: string

  @ApiPropertyOptional({ example: 'Jean' })
  @IsString() @IsOptional()
  firstName?: string

  @ApiPropertyOptional({ example: 'DUPONT' })
  @IsString() @IsOptional()
  lastName?: string

  @ApiPropertyOptional({ example: 'jean@vdm.ci' })
  @IsEmail() @IsOptional()
  email?: string

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  businessUnitId?: string

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  poleId?: string

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  managerId?: string

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  scheduleGroupId?: string

  @ApiPropertyOptional()
  @IsString() @IsOptional()
  individualExpectedArrivalTime?: string
}
