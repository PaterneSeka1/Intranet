import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsString } from 'class-validator'

export class AddParticipantsDto {
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  participantIds!: string[]
}
