import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Role } from '@prisma/client'

export class CreateUserDto {
  @ApiProperty({ example: 'JEAN_DUPONT' })
  @IsString() @IsNotEmpty() @MaxLength(50)
  username!: string

  @ApiProperty({ example: 'MotDePasse8+' })
  @IsString() @MinLength(8) @MaxLength(200)
  password!: string

  @ApiPropertyOptional({ example: 'Jean' })
  @IsString() @IsOptional() @MaxLength(100)
  firstName?: string

  @ApiPropertyOptional({ example: 'DUPONT' })
  @IsString() @IsOptional() @MaxLength(100)
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

  @ApiPropertyOptional({ example: '08:00' })
  @IsString() @IsOptional() @Matches(/^\d{2}:\d{2}$/, { message: 'Format HH:mm requis' })
  individualExpectedArrivalTime?: string
}
