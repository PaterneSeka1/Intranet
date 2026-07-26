import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { Role } from '@prisma/client'
import { AnnouncementsService } from './announcements.service'
import { CreateAnnouncementDto } from './dto/create-announcement.dto'
import { UpdateAnnouncementDto } from './dto/update-announcement.dto'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'

type JwtUser = { id: string; role: Role; businessUnitId?: string | null }

@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  findAll(@Query('active') active?: string, @CurrentUser() user?: JwtUser) {
    return this.announcementsService.findAll(user, active === 'true')
  }

  @Post()
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: JwtUser) {
    return this.announcementsService.create(dto, user)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.announcementsService.update(id, dto, user)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.announcementsService.remove(id, user)
  }
}
