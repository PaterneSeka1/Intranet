import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CongeEmployeePhoto, LeaveSyncService } from '../leaves/leave-sync.service'

/// La photo de profil n'est pas stockée dans VdM Intranet : c'est celle saisie dans l'app RH
/// (CONGE), rapprochée par matricule puis email — même logique que matchLeaveToUser
/// (matricule, sinon username pour les comptes importés avant le champ `matricule`).
@Injectable()
export class UserPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaveSync: LeaveSyncService
  ) {}

  async getPhoto(userId: string): Promise<CongeEmployeePhoto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, matricule: true, email: true },
    })
    if (!user) return null

    return this.leaveSync.getEmployeePhoto({
      matricule: user.matricule ?? user.username,
      email: user.email,
    })
  }
}
