import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import {
  CAN_VIEW_USERS,
  CAN_MANAGE_USERS,
  CAN_MANAGE_USERS_BU_SCOPE,
  CAN_MANAGE_USERS_SCOPED_WRITE,
} from '../common/permissions'

type JwtUser = {
  id: string
  role: Role
  businessUnitId?: string | null
  poleId?: string | null
}

@ApiTags('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mon profil' })
  me(@CurrentUser() user: JwtUser) {
    return this.usersService.findOne(user.id)
  }

  @Patch('me')
  @ApiOperation({ summary: 'Modifier mon profil (prénom, nom, email, mot de passe)' })
  updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.id, dto)
  }

  @Get()
  @Roles(...CAN_VIEW_USERS)
  @ApiOperation({ summary: 'Liste des utilisateurs (selon rôle)' })
  findAll(@CurrentUser() user: JwtUser) {
    return this.usersService.findAll(user)
  }

  @Get(':id')
  @Roles(...CAN_VIEW_USERS)
  @ApiOperation({ summary: "Détail d'un utilisateur (scopé selon rôle)" })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.findOne(id, user)
  }

  @Post()
  @Roles(...CAN_MANAGE_USERS)
  @ApiOperation({ summary: 'Créer un utilisateur (CTO_ADMIN, PDG)' })
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(dto, user)
  }

  @Patch(':id')
  @Roles(...CAN_MANAGE_USERS)
  @ApiOperation({ summary: 'Modifier un utilisateur (CTO_ADMIN, PDG)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: JwtUser) {
    return this.usersService.update(id, dto, user)
  }

  @Patch(':id/scoped')
  @Roles(...CAN_MANAGE_USERS_SCOPED_WRITE)
  @ApiOperation({
    summary:
      'Modifier un utilisateur de son périmètre (DAF/RESPONSABLE_BU : administratif + planning ; RESPONSABLE_POLE : planning uniquement) — jamais le rôle, la BU, le pôle ou le manager',
  })
  updateScoped(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: JwtUser) {
    return this.usersService.updateScoped(id, dto, user)
  }

  @Patch(':id/activate')
  @Roles(...CAN_MANAGE_USERS, ...CAN_MANAGE_USERS_BU_SCOPE)
  @ApiOperation({
    summary: 'Activer un compte (CTO_ADMIN, PDG, ou DAF/RESPONSABLE_BU sur leur BU)',
  })
  activate(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.setActive(id, true, user)
  }

  @Patch(':id/deactivate')
  @Roles(...CAN_MANAGE_USERS, ...CAN_MANAGE_USERS_BU_SCOPE)
  @ApiOperation({
    summary: 'Désactiver un compte (CTO_ADMIN, PDG, ou DAF/RESPONSABLE_BU sur leur BU)',
  })
  deactivate(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.setActive(id, false, user)
  }
}
