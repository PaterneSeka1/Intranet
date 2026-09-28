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
  /** Code de BU pour une audience restreinte ; absent = dossier global (visible de tous). */
  buCode?: string
  tabs: TabDef[]
}

// Même forme que TabsService.create/createFolder : l'audience est portée par le dossier, ses
// onglets n'en ont pas de propre (isGlobal false, aucune BU). Le dossier est reconnu par son nom
// et son audience ; il est créé s'il manque, puis seuls les onglets absents (par URL) sont ajoutés.
async function ensureFolder(def: FolderDef, buId: string | undefined, createdById: string) {
  const audience = buId
    ? { isGlobal: false, businessUnits: { some: { businessUnitId: buId } } }
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
        isGlobal: !buId,
        order: (max._max.order ?? -1) + 1,
        createdById,
        businessUnits: buId ? { create: { businessUnitId: buId } } : undefined,
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

  const tabsByBu: Record<string, TabDef[]> = {
    INFO: [
      {
        name: 'Google News',
        url: 'https://news.google.com',
        icon: 'newspaper',
        color: '#4285F4',
        description: 'Flux actualités Google',
      },
      {
        name: 'Google Alertes',
        url: 'https://www.google.fr/alerts',
        icon: 'bell',
        color: '#34A853',
        description: 'Alertes médias configurées',
      },
      {
        name: 'YouTube',
        url: 'https://www.youtube.com',
        icon: 'play-circle',
        color: '#FF0000',
        description: 'Veille vidéo',
      },
      {
        name: 'X / Twitter',
        url: 'https://x.com',
        icon: 'x',
        color: '#000000',
        description: 'Réseau social X',
      },
    ],
    EREP: [
      {
        name: 'X / Twitter',
        url: 'https://x.com',
        icon: 'x',
        color: '#000000',
        description: 'Suivi mentions X',
      },
      {
        name: 'Facebook',
        url: 'https://www.facebook.com',
        icon: 'users',
        color: '#1877F2',
        description: 'Suivi Facebook',
      },
      {
        name: 'LinkedIn',
        url: 'https://www.linkedin.com',
        icon: 'briefcase',
        color: '#0A66C2',
        description: 'Veille LinkedIn',
      },
      {
        name: 'Google Alertes',
        url: 'https://www.google.fr/alerts',
        icon: 'bell',
        color: '#34A853',
        description: 'Alertes e-réputation',
      },
    ],
    SCI: [
      {
        name: 'Google Drive',
        url: 'https://drive.google.com',
        icon: 'folder',
        color: '#4285F4',
        description: 'Documents partagés',
      },
      {
        name: 'Gmail',
        url: 'https://mail.google.com',
        icon: 'mail',
        color: '#EA4335',
        description: 'Messagerie',
      },
      {
        name: 'Trello',
        url: 'https://trello.com',
        icon: 'clipboard-list',
        color: '#0079BF',
        description: 'Gestion de projets',
      },
      {
        name: 'Notion',
        url: 'https://notion.so',
        icon: 'notebook-pen',
        color: '#000000',
        description: 'Base de connaissances',
      },
    ],
    ANALYSES: [
      {
        name: 'Google Drive',
        url: 'https://drive.google.com',
        icon: 'folder',
        color: '#4285F4',
        description: 'Rapports et analyses',
      },
      {
        name: 'Looker Studio',
        url: 'https://lookerstudio.google.com',
        icon: 'bar-chart',
        color: '#4285F4',
        description: 'Tableaux de bord',
      },
      {
        name: 'Google News',
        url: 'https://news.google.com',
        icon: 'newspaper',
        color: '#4285F4',
        description: 'Sources média',
      },
      {
        name: 'YouTube',
        url: 'https://www.youtube.com',
        icon: 'play-circle',
        color: '#FF0000',
        description: 'Veille audiovisuelle',
      },
    ],
    DT: [
      {
        name: 'GitHub',
        url: 'https://github.com',
        icon: 'git-branch',
        color: '#24292E',
        description: 'Dépôts de code',
      },
      {
        name: 'Vercel',
        url: 'https://vercel.com',
        icon: 'triangle',
        color: '#000000',
        description: 'Déploiements frontend',
      },
      {
        name: 'OVH',
        url: 'https://www.ovhcloud.com',
        icon: 'cloud',
        color: '#123F6D',
        description: 'Infrastructure serveurs',
      },
    ],
    DAF: [
      {
        name: 'Google Drive',
        url: 'https://drive.google.com',
        icon: 'folder',
        color: '#4285F4',
        description: 'Documents financiers',
      },
      {
        name: 'Gmail',
        url: 'https://mail.google.com',
        icon: 'mail',
        color: '#EA4335',
        description: 'Messagerie DAF',
      },
      {
        name: 'Excel Online',
        url: 'https://www.office.com/launch/excel',
        icon: 'sheet',
        color: '#217346',
        description: 'Tableaux comptables',
      },
    ],
  }

  for (const [buCode, tabs] of Object.entries(tabsByBu)) {
    const buId = bus[buCode]
    const createdById = buCode === 'DAF' ? daf.id : cto.id
    for (const tab of tabs) {
      const existing = await prisma.portalTab.findFirst({
        where: { url: tab.url, businessUnits: { some: { businessUnitId: buId } } },
        select: { id: true },
      })
      if (existing) continue
      await prisma.portalTab.create({
        data: {
          name: tab.name,
          icon: tab.icon,
          color: tab.color,
          description: tab.description,
          createdById,
          url: tab.url,
          isActive: true,
          businessUnits: { create: { businessUnitId: buId } },
        },
      })
      created.tabs++
      console.log(`  + Onglet [${buCode}] : ${tab.name}`)
    }
  }

  // ---- Dossiers d'onglets ----
  const folderDefs: FolderDef[] = [
    {
      // Comptes officiels VdM, visibles de tous.
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
      // Plateformes métier de la BU E-Réputation.
      name: 'Veille e-réputation',
      icon: 'bar-chart',
      color: '#F28C38',
      buCode: 'EREP',
      tabs: [
        {
          name: 'Mention',
          url: 'https://web.mention.com/',
          icon: 'bell',
          color: '#1F8FFF',
          description: 'Veille des mentions en ligne',
        },
        {
          name: 'Talkwalker',
          url: 'https://www.talkwalker.com/fr',
          icon: 'bar-chart',
          color: '#00A3E0',
          description: 'Écoute sociale et analyse',
        },
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
      // Outils généraux utilisés par la BU E-Réputation.
      name: 'Recherche & IA',
      icon: 'search',
      color: '#F28C38',
      buCode: 'EREP',
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
  ]
  for (const def of folderDefs) {
    await ensureFolder(def, def.buCode ? bus[def.buCode] : undefined, cto.id)
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
