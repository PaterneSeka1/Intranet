import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import type { Response } from 'express'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { ChatService } from './chat.service'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { UpdateConversationDto } from './dto/update-conversation.dto'
import { AddParticipantsDto } from './dto/add-participants.dto'
import { UpdateMessageDto } from './dto/update-message.dto'
import { TogglePinDto } from './dto/toggle-pin.dto'
import {
  MAX_FILES_PER_MESSAGE,
  MAX_FILE_SIZE_BYTES,
  chatUploadsDir,
  isDangerousFilename,
  randomStorageFilename,
} from './chat.storage'

type AuthUser = { id: string }

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('users')
  directory() {
    return this.chatService.directory()
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthUser) {
    return this.chatService.listConversations(user.id)
  }

  @Post('conversations')
  createConversation(@Body() dto: CreateConversationDto, @CurrentUser() user: AuthUser) {
    return this.chatService.createConversation(dto, user)
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.chatService.getConversation(id, user.id)
  }

  @Patch('conversations/:id')
  renameConversation(
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.chatService.renameConversation(id, dto.name, user)
  }

  @Patch('conversations/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.chatService.markRead(id, user)
  }

  @Patch('conversations/:id/pin')
  togglePin(@Param('id') id: string, @Body() dto: TogglePinDto, @CurrentUser() user: AuthUser) {
    return this.chatService.togglePin(id, dto.pinned, user)
  }

  @Delete('conversations/:id')
  deleteConversation(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.chatService.deleteConversation(id, user)
  }

  @Post('conversations/:id/participants')
  addParticipants(
    @Param('id') id: string,
    @Body() dto: AddParticipantsDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.chatService.addParticipants(id, dto, user)
  }

  @Delete('conversations/:id/participants/:userId')
  removeParticipant(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.chatService.removeParticipant(id, userId, user)
  }

  @Get('conversations/:id/messages')
  listMessages(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('before') before?: string,
    @Query('limit') limit?: string
  ) {
    return this.chatService.listMessages(
      id,
      user.id,
      before,
      limit ? parseInt(limit, 10) : undefined
    )
  }

  @Post('conversations/:id/messages')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_MESSAGE, {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, chatUploadsDir()),
        filename: (_req, file, cb) => cb(null, randomStorageFilename(file.originalname)),
      }),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (isDangerousFilename(file.originalname)) {
          cb(new BadRequestException(`Type de fichier non autorisé : ${file.originalname}`), false)
          return
        }
        cb(null, true)
      },
    })
  )
  sendMessage(
    @Param('id') id: string,
    @Body('body') body: string | undefined,
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    return this.chatService.sendMessage(id, body, files ?? [], user)
  }

  @Patch('messages/:id')
  editMessage(
    @Param('id') id: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.chatService.editMessage(id, dto.body, user)
  }

  @Delete('messages/:id')
  deleteMessage(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('scope') scope?: string
  ) {
    return this.chatService.deleteMessage(id, user, scope === 'me' ? 'me' : 'everyone')
  }

  @Get('attachments/:id')
  async downloadAttachment(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response
  ) {
    const { attachment, filePath } = await this.chatService.downloadAttachment(id, user)
    const asciiName = attachment.fileName.replace(/[^\x20-\x7E]/g, '_')
    res.setHeader('Content-Type', attachment.mimeType)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`
    )
    res.sendFile(filePath)
  }
}
