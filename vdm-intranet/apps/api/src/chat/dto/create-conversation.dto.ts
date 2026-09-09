import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { ConversationType } from '@prisma/client'

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type!: ConversationType

  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  participantIds!: string[]

  // Groupe uniquement — ignoré pour une conversation DIRECT (nom construit côté client).
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string
}
