import { IsString, IsNotEmpty, IsOptional, IsBoolean, Matches, MaxLength } from 'class-validator'

export class CreateMandateDto {
  @IsString()
  @IsNotEmpty()
  userId!: string

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'expectedArrivalTime must be HH:mm' })
  expectedArrivalTime!: string

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'expectedDepartureTime must be HH:mm' })
  expectedDepartureTime?: string

  /** Override explicite du flag nuit du groupe pour ce jour (ex: rotation jour/nuit/week-end). */
  @IsBoolean()
  @IsOptional()
  isNightShift?: boolean

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string
}
