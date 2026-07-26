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
  @Roles(Role.CTO_ADMIN, Role.PDG, Role.DAF, Role.RESPONSABLE_BU, Role.RESPONSABLE_POLE)
  @ApiOperation({ summary: 'Liste des utilisateurs (selon rôle)' })
  findAll(@CurrentUser() user: JwtUser) {
    return this.usersService.findAll(user)
  }

  @Get(':id')
  @Roles(Role.CTO_ADMIN, Role.PDG, Role.DAF, Role.RESPONSABLE_BU, Role.RESPONSABLE_POLE)
  @ApiOperation({ summary: "Détail d'un utilisateur (scopé selon rôle)" })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.findOne(id, user)
  }

  @Post()
  @Roles(Role.CTO_ADMIN, Role.PDG)
  @ApiOperation({ summary: 'Créer un utilisateur (CTO_ADMIN, PDG)' })
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(dto, user)
  }

  @Patch(':id')
  @Roles(Role.CTO_ADMIN, Role.PDG)
  @ApiOperation({ summary: 'Modifier un utilisateur (CTO_ADMIN, PDG)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: JwtUser) {
    return this.usersService.update(id, dto, user)
  }

  @Patch(':id/activate')
  @Roles(Role.CTO_ADMIN, Role.PDG)
  @ApiOperation({ summary: 'Activer un compte (CTO_ADMIN, PDG)' })
  activate(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.setActive(id, true, user)
  }

  @Patch(':id/deactivate')
  @Roles(Role.CTO_ADMIN, Role.PDG)
  @ApiOperation({ summary: 'Désactiver un compte (CTO_ADMIN, PDG)' })
  deactivate(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.setActive(id, false, user)
  }
}
