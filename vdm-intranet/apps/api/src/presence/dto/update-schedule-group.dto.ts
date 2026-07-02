import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator'

export class UpdateScheduleGroupDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'expectedArrivalTime must be HH:mm' })
  expectedArrivalTime?: string

  @IsString()
  @IsOptional()
  businessUnitId?: string

  @IsString()
  @IsOptional()
  poleId?: string

  @IsBoolean()
  @IsOptional()
  isNightShift?: boolean

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}
