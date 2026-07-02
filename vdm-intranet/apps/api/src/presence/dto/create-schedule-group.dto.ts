import { IsString, IsNotEmpty, IsOptional, IsBoolean, Matches } from 'class-validator'

export class CreateScheduleGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  code!: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'expectedArrivalTime must be HH:mm' })
  expectedArrivalTime!: string

  @IsString()
  @IsOptional()
  businessUnitId?: string

  @IsString()
  @IsOptional()
  poleId?: string

  @IsBoolean()
  @IsOptional()
  isNightShift?: boolean
}
