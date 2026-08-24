import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { CAN_MANAGE_USERS } from '../common/permissions'
import { LeavesService } from './leaves.service'

@UseGuards(JwtAuthGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  // Visible par tout le monde, sans restriction de rôle ni de BU — cf. demande explicite
  // d'un widget "employés en congé" accessible à toute l'entreprise depuis l'accueil.
  @Get('on-leave/today')
  getOnLeaveToday() {
    return this.leavesService.getOnLeaveToday()
  }

  // Réservé aux mêmes rôles que la création d'utilisateur (CAN_MANAGE_USERS) : alimente le
  // sélecteur "employé CONGE existant" du formulaire de création dans /utilisateurs.
  @Get('conge-employees')
  @UseGuards(RolesGuard)
  @Roles(...CAN_MANAGE_USERS)
  getCongeEmployeeCandidates() {
    return this.leavesService.getCongeEmployeeCandidates()
  }
}
