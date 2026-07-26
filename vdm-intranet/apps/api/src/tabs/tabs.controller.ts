import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { TabsService } from './tabs.service'
import { CreateTabDto } from './dto/create-tab.dto'
import { UpdateTabDto } from './dto/update-tab.dto'
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto'
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto'
import { CreatePoleDto } from './dto/create-pole.dto'
import { UpdatePoleDto } from './dto/update-pole.dto'
import { Role } from '@prisma/client'

type AuthUser = {
  id: string
  role: Role
  businessUnitId?: string | null
}

@ApiTags('tabs')
@UseGuards(JwtAuthGuard)
@Controller('tabs')
export class TabsController {
  constructor(private readonly tabsService: TabsService) {}

  // ---- Business Units ----

  @Get('business-units')
  @ApiOperation({ summary: 'Liste de toutes les BU actives' })
  getAllBu() {
    return this.tabsService.getAllBusinessUnits()
  }

  @Post('business-units')
  @ApiOperation({ summary: 'Créer une BU (CTO_ADMIN)' })
  createBu(@CurrentUser() user: AuthUser, @Body() dto: CreateBusinessUnitDto) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.tabsService.createBusinessUnit(dto)
  }

  @Patch('business-units/:id')
  @ApiOperation({ summary: 'Modifier une BU (CTO_ADMIN)' })
  updateBu(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessUnitDto
  ) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.tabsService.updateBusinessUnit(id, dto)
  }

  @Delete('business-units/:id')
  @ApiOperation({ summary: 'Supprimer une BU (CTO_ADMIN)' })
  deleteBu(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.tabsService.deleteBusinessUnit(id)
  }

  // ---- Pôles ----

  @Get('poles')
  @ApiOperation({ summary: 'Liste de tous les pôles actifs' })
  getAllPoles() {
    return this.tabsService.getAllPoles()
  }

  @Post('poles')
  @ApiOperation({ summary: 'Créer un pôle (CTO_ADMIN)' })
  createPole(@CurrentUser() user: AuthUser, @Body() dto: CreatePoleDto) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.tabsService.createPole(dto)
  }

  @Patch('poles/:id')
  @ApiOperation({ summary: 'Modifier un pôle (CTO_ADMIN)' })
  updatePole(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePoleDto) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.tabsService.updatePole(id, dto)
  }

  @Delete('poles/:id')
  @ApiOperation({ summary: 'Supprimer un pôle (CTO_ADMIN)' })
  deletePole(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (user.role !== Role.CTO_ADMIN) throw new ForbiddenException()
    return this.tabsService.deletePole(id)
  }

  @Get()
  @ApiOperation({ summary: 'Liste des onglets selon le périmètre' })
  findAll(@CurrentUser() user: AuthUser, @Query('businessUnitId') buId?: string) {
    return this.tabsService.findAll(user, buId)
  }

  @Post()
  @ApiOperation({ summary: 'Créer un onglet (CTO_ADMIN, RESPONSABLE_BU)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTabDto) {
    return this.tabsService.create(user, dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un onglet (CTO_ADMIN, RESPONSABLE_BU)' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTabDto) {
    return this.tabsService.update(user, id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un onglet (CTO_ADMIN, RESPONSABLE_BU)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tabsService.remove(user, id)
  }
}
