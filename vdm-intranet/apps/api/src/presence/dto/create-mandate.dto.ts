import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator'

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
  @MaxLength(500)
  @IsOptional()
  reason?: string
}
