import { ForbiddenException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { UsersService } from './users.service'
import type { PrismaService } from '../prisma/prisma.service'

/**
 * Couvre l'enrichissement de périmètre des managers scopés (DAF, RESPONSABLE_BU,
 * RESPONSABLE_POLE) : ils peuvent désormais agir sur les utilisateurs de leur périmètre
 * (`updateScoped`, `setActive`), mais jamais sur un pair/supérieur, hors de leur BU/pôle, sur
 * eux-mêmes, ni sur des champs sensibles (rôle, BU, pôle, manager).
 */
describe('UsersService — gestion scopée (DAF/RESPONSABLE_BU/RESPONSABLE_POLE)', () => {
  let service: UsersService
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock }
  }

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'target' }),
      },
    }
    service = new UsersService(prisma as unknown as PrismaService)
  })

  const dafBuA = { id: 'daf1', role: Role.DAF, businessUnitId: 'buA', poleId: null }
  const responsableBuA = {
    id: 'rbu1',
    role: Role.RESPONSABLE_BU,
    businessUnitId: 'buA',
    poleId: null,
  }
  const responsablePoleA = {
    id: 'rpole1',
    role: Role.RESPONSABLE_POLE,
    businessUnitId: null,
    poleId: 'poleA',
  }

  describe('updateScoped', () => {
    it("autorise un DAF à corriger l'e-mail d'un employé de sa BU", async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.EMPLOYE,
        businessUnitId: 'buA',
        poleId: null,
        firstName: 'Jean',
        lastName: 'Kouassi',
      })

      await service.updateScoped('target', { email: 'jean@vdm.ci' }, dafBuA)

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'target' },
          data: expect.objectContaining({ email: 'jean@vdm.ci' }),
        })
      )
    })

    it("refuse un DAF ciblant un employé d'une autre BU", async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.EMPLOYE,
        businessUnitId: 'buB',
        poleId: null,
        firstName: 'Jean',
        lastName: 'Kouassi',
      })

      await expect(
        service.updateScoped('target', { email: 'jean@vdm.ci' }, dafBuA)
      ).rejects.toThrow(ForbiddenException)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('refuse un RESPONSABLE_BU ciblant un pair DAF, même dans sa propre BU', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.DAF,
        businessUnitId: 'buA',
        poleId: null,
        firstName: 'Autre',
        lastName: 'Manager',
      })

      await expect(
        service.updateScoped('target', { email: 'x@vdm.ci' }, responsableBuA)
      ).rejects.toThrow(ForbiddenException)
    })

    it('refuse un RESPONSABLE_BU ciblant un CTO_ADMIN ou un PDG', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.PDG,
        businessUnitId: 'buA',
        poleId: null,
        firstName: 'Le',
        lastName: 'PDG',
      })

      await expect(
        service.updateScoped('target', { email: 'x@vdm.ci' }, responsableBuA)
      ).rejects.toThrow(ForbiddenException)
    })

    it('refuse tout auto-ciblage via cette action (doit passer par /users/me)', async () => {
      await expect(service.updateScoped('daf1', { email: 'x@vdm.ci' }, dafBuA)).rejects.toThrow(
        ForbiddenException
      )
      expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('ne modifie jamais le rôle, la BU, le pôle ou le manager même si fournis dans le dto', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.EMPLOYE,
        businessUnitId: 'buA',
        poleId: null,
        firstName: 'Jean',
        lastName: 'Kouassi',
      })

      await service.updateScoped(
        'target',
        {
          email: 'jean@vdm.ci',
          role: Role.RESPONSABLE_BU,
          businessUnitId: 'buB',
          poleId: 'poleZ',
          managerId: 'someone',
        } as never,
        dafBuA
      )

      const data = prisma.user.update.mock.calls[0][0].data
      expect(data).not.toHaveProperty('role')
      expect(data).not.toHaveProperty('businessUnitId')
      expect(data).not.toHaveProperty('poleId')
      expect(data).not.toHaveProperty('managerId')
      expect(data.email).toBe('jean@vdm.ci')
    })

    it('autorise un RESPONSABLE_POLE à modifier uniquement le planning de son pôle', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.CONSULTANT,
        businessUnitId: null,
        poleId: 'poleA',
        firstName: 'Awa',
        lastName: 'Traoré',
      })

      await service.updateScoped(
        'target',
        { scheduleGroupId: 'grpNuit', workingDays: [1, 2, 3, 4, 5] },
        responsablePoleA
      )

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ scheduleGroupId: 'grpNuit' }),
        })
      )
    })

    it('refuse un RESPONSABLE_POLE qui tente de modifier un champ administratif', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.CONSULTANT,
        businessUnitId: null,
        poleId: 'poleA',
        firstName: 'Awa',
        lastName: 'Traoré',
      })

      // Le DTO ne contient qu'un champ planning ; la restriction porte sur les champs *autorisés*
      // pour ce rôle (allowedFields), qui n'incluent jamais firstName/email/password.
      await service.updateScoped('target', { scheduleGroupId: 'grpNuit' }, responsablePoleA)
      const data = prisma.user.update.mock.calls[0][0].data
      expect(data).not.toHaveProperty('firstName')
      expect(data).not.toHaveProperty('email')
      expect(data).not.toHaveProperty('password')
    })

    it("refuse un RESPONSABLE_POLE ciblant un utilisateur d'un autre pôle", async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.CONSULTANT,
        businessUnitId: null,
        poleId: 'poleB',
        firstName: 'Awa',
        lastName: 'Traoré',
      })

      await expect(
        service.updateScoped('target', { scheduleGroupId: 'grpNuit' }, responsablePoleA)
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('setActive', () => {
    it('autorise un DAF à désactiver un employé de sa BU', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.EMPLOYE,
        businessUnitId: 'buA',
        poleId: null,
      })

      await service.setActive('target', false, dafBuA)

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } })
      )
    })

    it("refuse un DAF désactivant un utilisateur d'une autre BU", async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.EMPLOYE,
        businessUnitId: 'buB',
        poleId: null,
      })

      await expect(service.setActive('target', false, dafBuA)).rejects.toThrow(ForbiddenException)
    })

    it('refuse un RESPONSABLE_POLE (non habilité à activer/désactiver un compte)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        role: Role.CONSULTANT,
        businessUnitId: null,
        poleId: 'poleA',
      })

      await expect(service.setActive('target', false, responsablePoleA)).rejects.toThrow(
        ForbiddenException
      )
    })
  })
})
