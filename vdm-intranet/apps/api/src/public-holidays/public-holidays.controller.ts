import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { CAN_MANAGE_SETTINGS } from '../common/permissions'
import { PublicHolidaysService } from './public-holidays.service'
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto'
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto'

type AuthUser = { id: string; role: Role }

@ApiTags('public-holidays')
@UseGuards(JwtAuthGuard)
@Controller('public-holidays')
export class PublicHolidaysController {
  constructor(private readonly service: PublicHolidaysService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des jours fériés' })
  findAll() {
    return this.service.findAll()
  }

  @Post()
  @ApiOperation({ summary: 'Créer un jour férié (CTO_ADMIN)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePublicHolidayDto) {
    if (!CAN_MANAGE_SETTINGS.includes(user.role)) throw new ForbiddenException()
    return this.service.create(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un jour férié (CTO_ADMIN)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePublicHolidayDto
  ) {
    if (!CAN_MANAGE_SETTINGS.includes(user.role)) throw new ForbiddenException()
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un jour férié (CTO_ADMIN)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!CAN_MANAGE_SETTINGS.includes(user.role)) throw new ForbiddenException()
    return this.service.remove(id)
  }
}
