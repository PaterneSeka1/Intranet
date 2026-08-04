import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
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
}
