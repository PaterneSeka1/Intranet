import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { TabsService } from './tabs.service'
import { CreateTabDto } from './dto/create-tab.dto'
import { UpdateTabDto } from './dto/update-tab.dto'
import { CreateTabFolderDto } from './dto/create-tab-folder.dto'
import { UpdateTabFolderDto } from './dto/update-tab-folder.dto'
import { ReorderTabsDto } from './dto/reorder-tabs.dto'
import { ReorderTabFoldersDto } from './dto/reorder-tab-folders.dto'
import { SetTabCredentialDto } from './dto/set-tab-credential.dto'
import { CreateBusinessUnitDto } from './dto/create-business-unit.dto'
import { UpdateBusinessUnitDto } from './dto/update-business-unit.dto'
import { CreatePoleDto } from './dto/create-pole.dto'
import { UpdatePoleDto } from './dto/update-pole.dto'
import { Role } from '@prisma/client'
import { CAN_MANAGE_ORGANIZATION } from '../common/permissions'

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
    if (!CAN_MANAGE_ORGANIZATION.includes(user.role)) throw new ForbiddenException()
    return this.tabsService.createBusinessUnit(dto)
  }

  @Patch('business-units/:id')
  @ApiOperation({ summary: 'Modifier une BU (CTO_ADMIN)' })
  updateBu(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessUnitDto
  ) {
    if (!CAN_MANAGE_ORGANIZATION.includes(user.role)) throw new ForbiddenException()
    return this.tabsService.updateBusinessUnit(id, dto)
  }

  @Delete('business-units/:id')
  @ApiOperation({ summary: 'Supprimer une BU (CTO_ADMIN)' })
  deleteBu(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!CAN_MANAGE_ORGANIZATION.includes(user.role)) throw new ForbiddenException()
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
    if (!CAN_MANAGE_ORGANIZATION.includes(user.role)) throw new ForbiddenException()
    return this.tabsService.createPole(dto)
  }

  @Patch('poles/:id')
  @ApiOperation({ summary: 'Modifier un pôle (CTO_ADMIN)' })
  updatePole(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePoleDto) {
    if (!CAN_MANAGE_ORGANIZATION.includes(user.role)) throw new ForbiddenException()
    return this.tabsService.updatePole(id, dto)
  }

  @Delete('poles/:id')
  @ApiOperation({ summary: 'Supprimer un pôle (CTO_ADMIN)' })
  deletePole(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    if (!CAN_MANAGE_ORGANIZATION.includes(user.role)) throw new ForbiddenException()
    return this.tabsService.deletePole(id)
  }

  // ---- Dossiers d'onglets (routes statiques déclarées avant `:id` des onglets) ----

  @Get('folders')
  @ApiOperation({ summary: "Liste des dossiers d'onglets selon le périmètre" })
  findAllFolders(@CurrentUser() user: AuthUser, @Query('businessUnitId') buId?: string) {
    return this.tabsService.findAllFolders(user, buId)
  }

  @Post('folders')
  @ApiOperation({ summary: 'Créer un dossier (CTO_ADMIN, PDG, DAF, RESPONSABLE_BU)' })
  createFolder(@CurrentUser() user: AuthUser, @Body() dto: CreateTabFolderDto) {
    return this.tabsService.createFolder(user, dto)
  }

  @Patch('folders/reorder')
  @ApiOperation({ summary: 'Réordonner les dossiers (drag & drop)' })
  reorderFolders(@CurrentUser() user: AuthUser, @Body() dto: ReorderTabFoldersDto) {
    return this.tabsService.reorderFolders(user, dto)
  }

  @Patch('folders/:id')
  @ApiOperation({ summary: 'Modifier un dossier (CTO_ADMIN, PDG, DAF, RESPONSABLE_BU)' })
  updateFolder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTabFolderDto
  ) {
    return this.tabsService.updateFolder(user, id, dto)
  }

  @Delete('folders/:id')
  @ApiOperation({
    summary: 'Supprimer un dossier — les onglets sont conservés, non regroupés (CTO_ADMIN, PDG, DAF, RESPONSABLE_BU)',
  })
  removeFolder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tabsService.removeFolder(user, id)
  }

  // ---- Onglets ----

  @Get()
  @ApiOperation({ summary: 'Liste des onglets selon le périmètre' })
  findAll(@CurrentUser() user: AuthUser, @Query('businessUnitId') buId?: string) {
    return this.tabsService.findAll(user, buId)
  }

  @Post()
  @ApiOperation({ summary: 'Créer un onglet (CTO_ADMIN, PDG, DAF, RESPONSABLE_BU)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTabDto) {
    return this.tabsService.create(user, dto)
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Réordonner les onglets et/ou les déplacer entre dossiers (drag & drop)' })
  reorderTabs(@CurrentUser() user: AuthUser, @Body() dto: ReorderTabsDto) {
    return this.tabsService.reorderTabs(user, dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un onglet (CTO_ADMIN, PDG, DAF, RESPONSABLE_BU)' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTabDto) {
    return this.tabsService.update(user, id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un onglet (CTO_ADMIN, PDG, DAF, RESPONSABLE_BU)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tabsService.remove(user, id)
  }

  // ---- Identifiant partagé d'un onglet ----

  @Get(':id/credential')
  @ApiOperation({
    summary: "Révéler l'identifiant partagé d'un onglet (visible par qui voit l'onglet, journalisé)",
  })
  getCredential(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tabsService.getCredential(user, id)
  }

  @Put(':id/credential')
  @ApiOperation({
    summary:
      "Définir ou mettre à jour l'identifiant partagé d'un onglet (CTO_ADMIN, PDG, DAF, RESPONSABLE_BU)",
  })
  setCredential(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetTabCredentialDto
  ) {
    return this.tabsService.setCredential(user, id, dto)
  }

  @Delete(':id/credential')
  @ApiOperation({
    summary: "Supprimer l'identifiant partagé d'un onglet (CTO_ADMIN, PDG, DAF, RESPONSABLE_BU)",
  })
  removeCredential(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tabsService.deleteCredential(user, id)
  }
}
