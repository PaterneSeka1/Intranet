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
import { CAN_VIEW_USERS, CAN_MANAGE_USERS } from '../common/permissions'

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

  @Patch(':id/activate')
  @Roles(...CAN_MANAGE_USERS)
  @ApiOperation({ summary: 'Activer un compte (CTO_ADMIN, PDG)' })
  activate(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.setActive(id, true, user)
  }

  @Patch(':id/deactivate')
  @Roles(...CAN_MANAGE_USERS)
  @ApiOperation({ summary: 'Désactiver un compte (CTO_ADMIN, PDG)' })
  deactivate(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.setActive(id, false, user)
  }
}
