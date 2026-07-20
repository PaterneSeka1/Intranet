import { IsString, IsNotEmpty, IsOptional, IsBoolean, Matches, MaxLength } from 'class-validator'

export class CreateScheduleGroupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string

  @IsString()
  @IsOptional()
  @MaxLength(300)
  description?: string

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'expectedArrivalTime must be HH:mm' })
  expectedArrivalTime!: string

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'expectedDepartureTime must be HH:mm' })
  expectedDepartureTime?: string

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
