import { PrismaClient, Role } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// Seed additif : il complète la base sans jamais supprimer ni modifier l'existant. Chaque
// élément est recherché par ses clés uniques et créé seulement s'il manque — un enregistrement
// déjà présent (même modifié depuis dans l'app) est laissé tel quel. Rejouable sans risque.
const created = { bus: 0, poles: 0, groups: 0, users: 0, folders: 0, tabs: 0, holidays: 0 }

type TabDef = { name: string; url: string; icon: string; color?: string; description?: string }

type FolderDef = {
  name: string
  icon: string
  color: string
  /**
   * Codes des BU de l'audience restreinte ; absent = dossier global (visible de tous). Un outil
   * commun à plusieurs BU est déclaré une seule fois, dans un dossier partagé par ces BU.
   */
  buCodes?: string[]
  tabs: TabDef[]
}

// Même forme que TabsService.create/createFolder : l'audience est portée par le dossier, ses
// onglets n'en ont pas de propre (isGlobal false, aucune BU). Le dossier est reconnu par son nom
// et son audience (une BU en commun suffit) ; il est créé s'il manque, puis seuls les onglets
// absents (par URL) sont ajoutés. L'audience d'un dossier existant n'est jamais modifiée.
async function ensureFolder(def: FolderDef, buIds: string[], createdById: string) {
  const audience = buIds.length
    ? { isGlobal: false, businessUnits: { some: { businessUnitId: { in: buIds } } } }
    : { isGlobal: true }
  let folder = await prisma.portalTabFolder.findFirst({
    where: { name: def.name, ...audience },
    select: { id: true },
  })
  if (!folder) {
    const max = await prisma.portalTabFolder.aggregate({ _max: { order: true } })
    folder = await prisma.portalTabFolder.create({
      data: {
        name: def.name,
        icon: def.icon,
        color: def.color,
        isGlobal: !buIds.length,
        order: (max._max.order ?? -1) + 1,
        createdById,
        businessUnits: buIds.length
          ? { create: buIds.map((businessUnitId) => ({ businessUnitId })) }
          : undefined,
      },
      select: { id: true },
    })
    created.folders++
    console.log(`  + Dossier : ${def.name}`)
  }

  for (const [index, tab] of def.tabs.entries()) {
    const existing = await prisma.portalTab.findFirst({
      where: { url: tab.url, folderId: folder.id },
      select: { id: true },
    })
    if (existing) continue
    await prisma.portalTab.create({
      data: { ...tab, folderId: folder.id, order: index, createdById, isActive: true },
    })
    created.tabs++
    console.log(`  + Onglet [${def.name}] : ${tab.name}`)
  }
}

async function main() {
  console.log('Seed Module 4 — VdM Intranet')

  const seedPassword = process.env.SEED_PASSWORD
  if (!seedPassword) {
    throw new Error(
      'SEED_PASSWORD manquant. Définissez-le dans votre .env avant de lancer le seed.\n' +
        'Exemple : SEED_PASSWORD="MotDePasse-Fort-2024!"'
    )
  }
  const pwd = await bcrypt.hash(seedPassword, 12)

  // ---- Business Units ----
  const buDefs = [
    { name: 'Direction Générale', code: 'DG' },
    { name: 'Direction Technique', code: 'DT' },
    { name: 'Direction Administrative et Financière', code: 'DAF' },
    { name: 'Information', code: 'INFO' },
    { name: 'E-Réputation', code: 'EREP' },
    { name: 'SCI', code: 'SCI' },
    { name: 'Analyses Médiatiques', code: 'ANALYSES' },
  ]

  const bus: Record<string, string> = {}
  for (const bu of buDefs) {
    // `name` est aussi unique : une BU renommée ou recodée dans l'app est reconnue par l'un ou l'autre.
    const existing = await prisma.businessUnit.findFirst({
      where: { OR: [{ code: bu.code }, { name: bu.name }] },
      select: { id: true },
    })
    if (existing) {
      bus[bu.code] = existing.id
      continue
    }
    const r = await prisma.businessUnit.create({ data: bu })
    bus[bu.code] = r.id
    created.bus++
    console.log(`  + BU : ${bu.name}`)
  }

  // ---- Pôles ----
  const poleDefs = [
    { name: 'Presse / Jour', code: 'POLE_PRESSE_JOUR', buCode: 'INFO' },
    { name: 'Nuit', code: 'POLE_NUIT', buCode: 'INFO' },
    { name: 'TV / Radio', code: 'POLE_TVRADIO', buCode: 'INFO' },
    { name: 'Qualité & Service Client', code: 'POLE_QSC', buCode: 'SCI' },
    { name: 'IA & Développement', code: 'POLE_IA_DEV', buCode: 'DT' },
  ]

  const poles: Record<string, string> = {}
  for (const p of poleDefs) {
    const existing = await prisma.pole.findUnique({ where: { code: p.code }, select: { id: true } })
    if (existing) {
      poles[p.code] = existing.id
      continue
    }
    const r = await prisma.pole.create({
      data: { name: p.name, code: p.code, businessUnitId: bus[p.buCode] },
    })
    poles[p.code] = r.id
    created.poles++
    console.log(`  + Pôle : ${p.name}`)
  }

  // ---- Groupes horaires ----
  const groupDefs = [
    {
      code: 'JOUR_0800',
      name: 'Jour — 08h00',
      expectedArrivalTime: '08:00',
      expectedDepartureTime: '17:00',
      isNightShift: false,
    },
    {
      code: 'JOUR_0830',
      name: 'Jour — 08h30',
      expectedArrivalTime: '08:30',
      expectedDepartureTime: '17:30',
      isNightShift: false,
    },
    {
      code: 'JOUR_0900',
      name: 'Jour — 09h00',
      expectedArrivalTime: '09:00',
      expectedDepartureTime: '18:00',
      isNightShift: false,
    },
    {
      code: 'NUIT_2000',
      name: 'Nuit — 20h00',
      expectedArrivalTime: '20:00',
      expectedDepartureTime: '05:00',
      isNightShift: true,
    },
  ]

  const groups: Record<string, string> = {}
  for (const g of groupDefs) {
    const existing = await prisma.scheduleGroup.findUnique({
      where: { code: g.code },
      select: { id: true },
    })
    if (existing) {
      groups[g.code] = existing.id
      continue
    }
    const r = await prisma.scheduleGroup.create({ data: g })
    groups[g.code] = r.id
    created.groups++
    console.log(`  + Groupe : ${g.name}`)
  }

  // ---- Utilisateurs ----
  type UserDef = {
    username: string
    firstName: string
    lastName: string
    role: Role
    buCode?: string
    poleCode?: string
    managerUsername?: string
    groupCode?: string
    individualExpectedArrivalTime?: string
    /** Optionnel — sinon dérivé de `username` (email obligatoire pour tout le monde sans exception). */
    email?: string
  }

  const userDefs: UserDef[] = [
    // Direction
    {
      username: 'CTO',
      firstName: 'Franck-Emmanuel',
      lastName: 'OUFFOUET',
      role: 'CTO_ADMIN',
      buCode: 'DT',
      managerUsername: 'PDG',
      groupCode: 'JOUR_0830',
    },
    {
      username: 'PDG',
      firstName: 'Fabrice',
      lastName: 'PIOFRET',
      role: 'PDG',
      buCode: 'DG',
      individualExpectedArrivalTime: '08:30',
    },
    {
      username: 'DAF',
      firstName: 'Matirangue',
      lastName: 'SANOGO',
      role: 'DAF',
      buCode: 'DAF',
      managerUsername: 'PDG',
      groupCode: 'JOUR_0800',
    },
    // Responsables BU
    // Note gouvernance (contexte_vdm_compact_avec_schema.md) : seule la BU SCI dépend
    // hiérarchiquement du CTO ("CTO --> SCI", lien plein). Les BU Information, E-Réputation et
    // Analyses Médiatiques n'ont qu'une coordination opérationnelle du CTO ("-.->", lien pointillé
    // explicitement non hiérarchique) et aucun autre rattachement hiérarchique n'est documenté :
    // managerUsername reste donc volontairement absent pour RBU_INFO/RBU_EREP/RBU_ANALYSES plutôt
    // que d'inventer un rattachement non spécifié par la source de vérité.
    {
      username: 'RBU_INFO',
      firstName: 'Stephen',
      lastName: 'KOUAKOU',
      role: 'RESPONSABLE_BU',
      buCode: 'INFO',
      groupCode: 'JOUR_0830',
    },
    {
      username: 'RBU_EREP',
      firstName: 'Edmond',
      lastName: 'KONAN',
      role: 'RESPONSABLE_BU',
      buCode: 'EREP',
      groupCode: 'JOUR_0830',
    },
    {
      username: 'RBU_SCI',
      firstName: 'Appolon',
      lastName: 'DOGO',
      role: 'RESPONSABLE_BU',
      buCode: 'SCI',
      managerUsername: 'CTO',
      groupCode: 'JOUR_0830',
    },
    {
      username: 'RBU_ANALYSES',
      firstName: 'Joël',
      lastName: 'TCHETEHO',
      role: 'RESPONSABLE_BU',
      buCode: 'ANALYSES',
      groupCode: 'JOUR_0830',
    },
    // Responsables Pôle — rattachés hiérarchiquement au responsable de leur BU (INFO)
    {
      username: 'POLE_PRESSE_JOUR',
      firstName: 'Jefferson',
      lastName: 'AGBO',
      role: 'RESPONSABLE_POLE',
      buCode: 'INFO',
      poleCode: 'POLE_PRESSE_JOUR',
      managerUsername: 'RBU_INFO',
      groupCode: 'JOUR_0830',
    },
    {
      username: 'POLE_NUIT',
      firstName: 'Jean-Charles',
      lastName: 'ANOUGBA',
      role: 'RESPONSABLE_POLE',
      buCode: 'INFO',
      poleCode: 'POLE_NUIT',
      managerUsername: 'RBU_INFO',
      groupCode: 'NUIT_2000',
    },
    {
      username: 'POLE_TVRADIO',
      firstName: 'Abel',
      lastName: "N'DRI",
      role: 'RESPONSABLE_POLE',
      buCode: 'INFO',
      poleCode: 'POLE_TVRADIO',
      managerUsername: 'RBU_INFO',
      groupCode: 'JOUR_0830',
    },
    // Consultants INFO — rattachés au responsable de leur pôle
    {
      username: 'CONS_PJ_1',
      firstName: 'Consultant',
      lastName: 'Presse Jour 1',
      role: 'CONSULTANT',
      buCode: 'INFO',
      poleCode: 'POLE_PRESSE_JOUR',
      managerUsername: 'POLE_PRESSE_JOUR',
      groupCode: 'JOUR_0900',
    },
    {
      username: 'CONS_NUIT_1',
      firstName: 'Consultant',
      lastName: 'Nuit 1',
      role: 'CONSULTANT',
      buCode: 'INFO',
      poleCode: 'POLE_NUIT',
      managerUsername: 'POLE_NUIT',
      groupCode: 'NUIT_2000',
    },
    {
      username: 'CONS_TVR_1',
      firstName: 'Consultant',
      lastName: 'TV Radio 1',
      role: 'CONSULTANT',
      buCode: 'INFO',
      poleCode: 'POLE_TVRADIO',
      managerUsername: 'POLE_TVRADIO',
      groupCode: 'JOUR_0900',
    },
    // EREP — pas de pôle intermédiaire, équipe rattachée directement au responsable de BU
    {
      username: 'ANGE_KAPET',
      firstName: 'Ange',
      lastName: 'KAPET',
      role: 'EMPLOYE',
      buCode: 'EREP',
      managerUsername: 'RBU_EREP',
      groupCode: 'JOUR_0900',
    },
    {
      username: 'STAG_EREP_1',
      firstName: 'Stagiaire',
      lastName: 'E-Réputation 1',
      role: 'STAGIAIRE',
      buCode: 'EREP',
      managerUsername: 'RBU_EREP',
      groupCode: 'JOUR_0900',
      email: 'stag.erep.1@vdm.local',
    },
    // SCI — équipe Qualité & Service Client, rattachée directement au responsable de BU
    // (pas de rôle RESPONSABLE_POLE dédié pour POLE_QSC)
    {
      username: 'LILIANE_KONAN',
      firstName: 'Liliane',
      lastName: 'KONAN',
      role: 'EMPLOYE',
      buCode: 'SCI',
      poleCode: 'POLE_QSC',
      managerUsername: 'RBU_SCI',
      groupCode: 'JOUR_0900',
    },
    {
      username: 'ANDREAS_BONI',
      firstName: 'Andréas',
      lastName: 'BONI',
      role: 'EMPLOYE',
      buCode: 'SCI',
      poleCode: 'POLE_QSC',
      managerUsername: 'RBU_SCI',
      groupCode: 'JOUR_0900',
    },
    // Analyses — pas de pôle intermédiaire, équipe rattachée directement au responsable de BU
    {
      username: 'ME_KOUAKOU',
      firstName: 'Marie-Emmanuelle',
      lastName: 'KOUAKOU',
      role: 'EMPLOYE',
      buCode: 'ANALYSES',
      managerUsername: 'RBU_ANALYSES',
      groupCode: 'JOUR_0900',
    },
    {
      username: 'JOSEPH_TANO',
      firstName: 'Joseph',
      lastName: 'TANO',
      role: 'EMPLOYE',
      buCode: 'ANALYSES',
      managerUsername: 'RBU_ANALYSES',
      groupCode: 'JOUR_0900',
    },
    {
      username: 'HENRI_AMAN',
      firstName: 'Henri-Emmanuel',
      lastName: 'AMAN',
      role: 'EMPLOYE',
      buCode: 'ANALYSES',
      managerUsername: 'RBU_ANALYSES',
      groupCode: 'JOUR_0900',
    },
    // DT — pas de responsable de BU dédié distinct du CTO (qui dirige la Direction Technique) ;
    // Glenn/Boldcode est "Lead IA & développement" mais son rôle PRESTATAIRE n'est pas éligible
    // comme manager direct (select applicatif restreint aux rôles de direction/responsabilité).
    {
      username: 'STAG_TECH_1',
      firstName: 'Stagiaire',
      lastName: 'Technique 1',
      role: 'STAGIAIRE',
      buCode: 'DT',
      poleCode: 'POLE_IA_DEV',
      managerUsername: 'CTO',
      groupCode: 'JOUR_0900',
      email: 'stag.tech.1@vdm.local',
    },
    {
      username: 'GLENN_BOLDCODE',
      firstName: 'Glenn',
      lastName: 'Boldcode',
      role: 'PRESTATAIRE',
      buCode: 'DT',
      poleCode: 'POLE_IA_DEV',
      managerUsername: 'CTO',
      individualExpectedArrivalTime: '10:00',
    },
  ]

  const userIds: Record<string, string> = {}
  const createdUsernames = new Set<string>()
  for (const u of userDefs) {
    const fullName = `${u.firstName} ${u.lastName}`
    // Email obligatoire pour tout le monde sans exception — dérivé de `username` si non précisé.
    const email = u.email ?? `${u.username.toLowerCase()}@vdm.local`
    // Stagiaire : pas de matricule, l'email est son seul identifiant de connexion.
    const matricule = u.role === 'STAGIAIRE' ? undefined : u.username
    // username, matricule et email sont tous uniques : un compte existant qui en partage un
    // seul est considéré comme déjà présent (et jamais modifié), sinon la création échouerait.
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: u.username }, { email }, ...(matricule ? [{ matricule }] : [])] },
      select: { id: true },
    })
    if (existing) {
      userIds[u.username] = existing.id
      continue
    }
    const r = await prisma.user.create({
      data: {
        username: u.username,
        // Connexion locale/dev : matricule aligné sur username pour que les identifiants de seed
        // (ex: "CTO") continuent de fonctionner tels quels — cf. AuthService.login (matricule ou
        // email, jamais username). Absent pour un stagiaire, qui se connecte avec son email.
        matricule,
        email,
        passwordHash: pwd,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName,
        role: u.role,
        businessUnitId: u.buCode ? bus[u.buCode] : undefined,
        poleId: u.poleCode ? poles[u.poleCode] : undefined,
        scheduleGroupId: u.groupCode ? groups[u.groupCode] : undefined,
        individualExpectedArrivalTime: u.individualExpectedArrivalTime,
        mustChangePassword: true,
      },
    })
    userIds[u.username] = r.id
    createdUsernames.add(u.username)
    created.users++
    console.log(`  + ${u.username} — ${u.role}`)
  }

  // Manager direct : uniquement pour les comptes créés par ce run (jamais pour un existant).
  for (const u of userDefs) {
    if (!u.managerUsername || !createdUsernames.has(u.username)) continue
    const userId = userIds[u.username]
    const managerId = userIds[u.managerUsername]
    if (!userId || !managerId) {
      throw new Error(`Manager direct introuvable pour ${u.username}.`)
    }
    await prisma.user.update({
      where: { id: userId },
      data: { managerId },
    })
    console.log(`  Manager direct : ${u.username} -> ${u.managerUsername}`)
  }

  // ---- Onglets par BU (créés par le responsable applicatif du périmètre) ----
  const cto = { id: userIds['CTO'] }
  const daf = { id: userIds['DAF'] }
  if (!cto.id) throw new Error('CTO user not found')
  if (!daf.id) throw new Error('DAF user not found')

  // Onglets sans dossier : chaque outil n'est déclaré qu'une fois, avec la liste des BU qui s'en
  // servent (un seul onglet partagé plutôt qu'une copie par BU). Reconnu par son URL parmi les
  // onglets sans dossier d'une de ces BU ; l'audience d'un onglet existant n'est jamais modifiée.
  const looseTabDefs: (TabDef & { buCodes: string[] })[] = [
    {
      name: 'Google News',
      url: 'https://news.google.com',
      icon: 'newspaper',
      color: '#4285F4',
      description: 'Flux d’actualités Google',
      buCodes: ['INFO', 'ANALYSES'],
    },
    {
      name: 'Google Alertes',
      url: 'https://www.google.fr/alerts',
      icon: 'bell',
      color: '#34A853',
      description: 'Alertes médias et e-réputation',
      buCodes: ['INFO', 'EREP'],
    },
    {
      // Mention, commun à l'E-Réputation et aux Analyses Médiatiques : URL d'accueil générique
      // (chacun arrive sur son espace de travail) plutôt qu'un lien profond propre à une BU.
      name: 'Mention',
      url: 'https://web.mention.com/',
      icon: 'bell',
      color: '#1F8FFF',
      description: 'Veille des mentions en ligne',
      buCodes: ['EREP', 'ANALYSES'],
    },
    {
      name: 'Trello',
      url: 'https://trello.com',
      icon: 'clipboard-list',
      color: '#0079BF',
      description: 'Gestion de projets',
      buCodes: ['SCI'],
    },
    {
      name: 'Notion',
      url: 'https://notion.so',
      icon: 'notebook-pen',
      color: '#000000',
      description: 'Base de connaissances',
      buCodes: ['SCI'],
    },
    {
      name: 'Looker Studio',
      url: 'https://lookerstudio.google.com',
      icon: 'bar-chart',
      color: '#4285F4',
      description: 'Tableaux de bord',
      buCodes: ['ANALYSES'],
    },
    {
      name: 'GitHub',
      url: 'https://github.com',
      icon: 'git-branch',
      color: '#24292E',
      description: 'Dépôts de code',
      buCodes: ['DT'],
    },
    {
      name: 'Vercel',
      url: 'https://vercel.com',
      icon: 'triangle',
      color: '#000000',
      description: 'Déploiements frontend',
      buCodes: ['DT'],
    },
    {
      name: 'OVH',
      url: 'https://www.ovhcloud.com',
      icon: 'cloud',
      color: '#123F6D',
      description: 'Infrastructure serveurs',
      buCodes: ['DT'],
    },
    {
      name: 'Excel Online',
      url: 'https://www.office.com/launch/excel',
      icon: 'sheet',
      color: '#217346',
      description: 'Tableurs Excel',
      buCodes: ['DAF', 'ANALYSES'],
    },
  ]

  for (const { buCodes, ...tab } of looseTabDefs) {
    const buIds = buCodes.map((code) => bus[code])
    const createdById = buCodes.every((code) => code === 'DAF') ? daf.id : cto.id
    const existing = await prisma.portalTab.findFirst({
      where: {
        url: tab.url,
        folderId: null,
        businessUnits: { some: { businessUnitId: { in: buIds } } },
      },
      select: { id: true },
    })
    if (existing) continue
    await prisma.portalTab.create({
      data: {
        ...tab,
        createdById,
        isActive: true,
        businessUnits: { create: buIds.map((businessUnitId) => ({ businessUnitId })) },
      },
    })
    created.tabs++
    console.log(`  + Onglet [${buCodes.join(', ')}] : ${tab.name}`)
  }

  // ---- Dossiers d'onglets ----
  const folderDefs: FolderDef[] = [
    {
      // Réseaux sociaux (comptes officiels VdM), utilisés par toutes les BU et visibles de tous —
      // pas d'onglet réseau en double ailleurs.
      name: 'Réseaux sociaux',
      icon: 'users',
      color: '#F28C38',
      tabs: [
        {
          name: 'Facebook',
          url: 'https://www.facebook.com/veilleurdesmedias',
          icon: 'facebook',
          color: '#1877F2',
          description: 'Page Facebook officielle',
        },
        {
          name: 'LinkedIn',
          url: 'https://www.linkedin.com/company/veilleur-des-m%C3%A9dias/posts/?feedView=all',
          icon: 'linkedin',
          color: '#0A66C2',
          description: 'Page LinkedIn officielle',
        },
        {
          name: 'Instagram',
          url: 'https://www.instagram.com/veilleur_des_medias/',
          icon: 'instagram',
          color: '#E4405F',
          description: 'Compte Instagram officiel',
        },
        {
          name: 'TikTok',
          url: 'https://www.tiktok.com/@veilleurdesmedias?_r=1&_t=ZS-9A1zYzJ71mO',
          icon: 'tiktok',
          color: '#000000',
          description: 'Compte TikTok officiel',
        },
        {
          name: 'X',
          url: 'https://x.com/veilleurmedias',
          icon: 'x',
          color: '#000000',
          description: 'Compte X officiel',
        },
        {
          name: 'YouTube',
          url: 'https://www.youtube.com/@VeilleurdesMedias',
          icon: 'youtube',
          color: '#FF0000',
          description: 'Chaîne YouTube officielle',
        },
      ],
    },
    {
      // Plateforme de travail utilisée par toutes les BU, visible de tous.
      name: 'Plateforme de travail',
      icon: 'newspaper',
      color: '#F28C38',
      tabs: [
        {
          name: 'Smart VdM',
          url: 'https://smart.veilleurdesmedias.com/dashboard',
          icon: 'newspaper',
          color: '#F28C38',
          description: 'Tableau de bord Smart VdM',
        },
      ],
    },
    {
      // Messageries utilisées par toutes les BU, visibles de tous.
      name: 'Boîtes mail',
      icon: 'mail',
      color: '#F28C38',
      tabs: [
        {
          name: 'Gmail',
          url: 'https://mail.google.com/',
          icon: 'mail',
          color: '#EA4335',
          description: 'Messagerie Google',
        },
        {
          name: 'OVH Webmail',
          url: 'https://mail.ovh.net/roundcube/',
          icon: 'mail',
          color: '#123F6D',
          description: 'Messagerie professionnelle OVH',
        },
      ],
    },
    {
      // Plateformes métier de la BU E-Réputation.
      name: 'Veille e-réputation',
      icon: 'bar-chart',
      color: '#F28C38',
      buCodes: ['EREP'],
      tabs: [
        {
          name: 'Talkwalker',
          url: 'https://www.talkwalker.com/fr',
          icon: 'bar-chart',
          color: '#00A3E0',
          description: 'Écoute sociale et analyse',
        },
      ],
    },
    {
      // Outils généraux utilisés par les BU E-Réputation et Analyses Médiatiques.
      name: 'Recherche & IA',
      icon: 'search',
      color: '#F28C38',
      buCodes: ['EREP', 'ANALYSES'],
      tabs: [
        {
          name: 'Google',
          url: 'https://www.google.com/',
          icon: 'search',
          color: '#4285F4',
          description: 'Moteur de recherche',
        },
        {
          name: 'Claude',
          url: 'https://claude.ai/',
          icon: 'sparkles',
          color: '#D97757',
          description: 'Assistant IA',
        },
      ],
    },
    {
      // BU Analyses Médiatiques — outils propres à la BU (les outils communs sont partagés ailleurs).
      name: 'Analyses médiatiques',
      icon: 'bar-chart',
      color: '#F28C38',
      buCodes: ['ANALYSES'],
      tabs: [
        {
          name: 'PowerPoint',
          url: 'https://www.office.com/launch/powerpoint',
          icon: 'presentation',
          color: '#D24726',
          description: 'Présentations des analyses',
        },
        {
          name: 'Prompt Cowboy',
          url: 'https://www.promptcowboy.ai/',
          icon: 'sparkles',
          color: '#B45309',
          description: 'Rédaction et optimisation de prompts IA',
        },
      ],
    },
    {
      // BU Information — applications de téléchargement et de conversion.
      name: 'Téléchargement & conversion',
      icon: 'download',
      color: '#F28C38',
      buCodes: ['INFO'],
      tabs: [
        {
          name: 'TurboScribe',
          url: 'https://turboscribe.ai/fr/',
          icon: 'file-text',
          color: '#6D28D9',
          description: 'Transcription audio et vidéo',
        },
        {
          name: 'FreeConvert',
          url: 'https://www.freeconvert.com/fr',
          icon: 'download',
          color: '#2563EB',
          description: 'Conversion de fichiers',
        },
        {
          name: 'SaveFrom',
          url: 'https://fr.savefrom.net/351Dr/',
          icon: 'download',
          color: '#16A34A',
          description: 'Téléchargement de vidéos en ligne',
        },
        {
          name: 'FBDownLoader',
          url: 'https://fbdownloader.to/fr',
          icon: 'facebook',
          color: '#1877F2',
          description: 'Téléchargement de vidéos Facebook',
        },
        {
          name: 'SSYouTube',
          url: 'https://fr.ssyoutube.com/',
          icon: 'youtube',
          color: '#FF0000',
          description: 'Téléchargement de vidéos YouTube',
        },
        {
          name: 'Convertio',
          url: 'https://convertio.co/fr/',
          icon: 'download',
          color: '#E11D48',
          description: 'Conversion de fichiers',
        },
        {
          name: 'WeTransfer',
          url: 'https://wetransfer.com/',
          icon: 'cloud',
          color: '#409FFF',
          description: 'Transfert de fichiers volumineux',
        },
      ],
    },
    {
      // Stockage et gestion des fichiers, commun à la BU Information et aux BU déjà équipées
      // de Google Drive (un seul Drive partagé au lieu d'un onglet par BU).
      name: 'Stockage & données',
      icon: 'folder',
      color: '#F28C38',
      buCodes: ['INFO', 'SCI', 'ANALYSES', 'DAF'],
      tabs: [
        {
          name: 'Google Drive',
          url: 'https://drive.google.com/drive/home',
          icon: 'folder',
          color: '#4285F4',
          description: 'Fichiers et dossiers partagés',
        },
        {
          name: 'Google Sheets',
          url: 'https://docs.google.com/spreadsheets/u/0/',
          icon: 'sheet',
          color: '#0F9D58',
          description: 'Feuilles de calcul',
        },
        {
          name: 'Google Docs',
          url: 'https://docs.google.com/document/u/0/',
          icon: 'file-text',
          color: '#4285F4',
          description: 'Documents texte',
        },
      ],
    },
    {
      // BU Information — enregistrement et acquisition des points d'information.
      name: 'Points d’information',
      icon: 'tv',
      color: '#F28C38',
      buCodes: ['INFO'],
      tabs: [
        {
          name: 'VLC Media Player',
          url: 'https://vlc-media-player.fr.softonic.com/telecharger',
          icon: 'play-circle',
          color: '#FF8800',
          description: 'Enregistrement des points d’information',
        },
        {
          name: 'My Canal',
          url: 'https://www.canalplus.com/ci/',
          icon: 'tv',
          color: '#000000',
          description: 'Acquisition des programmes TV',
        },
        {
          name: 'Flux médiatiques',
          url: 'https://docs.google.com/spreadsheets/d/1Kmnqed-VpqpBlg77vO6HQ5W5v5HmwvG0Tk-GfLWfrYc/edit?gid=0#gid=0',
          icon: 'sheet',
          color: '#0F9D58',
          description: 'Liste des flux médiatiques suivis',
        },
      ],
    },
    {
      // BU Information — intelligence artificielle et correction.
      name: 'Intelligence artificielle',
      icon: 'sparkles',
      color: '#F28C38',
      buCodes: ['INFO'],
      tabs: [
        {
          name: 'Gemini',
          url: 'https://gemini.google.com/app?hl=fr',
          icon: 'sparkles',
          color: '#1A73E8',
          description: 'Assistant IA Google',
        },
        {
          name: 'ChatGPT',
          url: 'https://chatgpt.com/',
          icon: 'sparkles',
          color: '#10A37F',
          description: 'Assistant IA OpenAI',
        },
        {
          name: 'SpellBoy',
          url: 'https://www.spellboy.com/verification_orthographique/',
          icon: 'spell-check',
          color: '#DC2626',
          description: 'Vérification orthographique',
        },
      ],
    },
  ]
  for (const def of folderDefs) {
    await ensureFolder(
      def,
      (def.buCodes ?? []).map((code) => bus[code]),
      cto.id
    )
  }

  // ---- Jours fériés (Côte d'Ivoire — dates fixes récurrentes) ----
  const holidayDefs = [
    { date: '2026-01-01', label: 'Jour de l’An' },
    { date: '2026-05-01', label: 'Fête du Travail' },
    { date: '2026-08-07', label: 'Fête de l’Indépendance' },
    { date: '2026-08-15', label: 'Assomption' },
    { date: '2026-11-01', label: 'Toussaint' },
    { date: '2026-11-15', label: 'Journée nationale de la Paix' },
    { date: '2026-12-25', label: 'Noël' },
  ]
  for (const h of holidayDefs) {
    const date = new Date(`${h.date}T00:00:00.000Z`)
    const existing = await prisma.publicHoliday.findUnique({
      where: { date_label: { date, label: h.label } },
      select: { id: true },
    })
    if (existing) continue
    await prisma.publicHoliday.create({ data: { date, label: h.label, isRecurring: true } })
    created.holidays++
  }
  console.log('  Jours fériés fixes vérifiés (fêtes religieuses mobiles à saisir manuellement).')

  console.log(
    `\nSeed terminé — ajoutés : ${created.users} utilisateurs, ${created.bus} BU, ${created.poles} pôles, ` +
      `${created.groups} groupes, ${created.folders} dossiers, ${created.tabs} onglets, ${created.holidays} jours fériés. ` +
      'Rien de l’existant n’a été supprimé ni modifié.'
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
