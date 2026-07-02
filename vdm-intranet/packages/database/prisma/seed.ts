import { PrismaClient, Role } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Seed Module 4 — VDM Intranet')

  const pwd = await bcrypt.hash('1234', 10)

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
    const r = await prisma.businessUnit.upsert({
      where: { code: bu.code },
      update: { name: bu.name },
      create: bu,
    })
    bus[bu.code] = r.id
    console.log(`  BU : ${bu.name}`)
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
    const r = await prisma.pole.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: { name: p.name, code: p.code, businessUnitId: bus[p.buCode] },
    })
    poles[p.code] = r.id
    console.log(`  Pôle : ${p.name}`)
  }

  // ---- Groupes horaires ----
  const groupDefs = [
    { code: 'JOUR_0800', name: 'Jour — 08h00', expectedArrivalTime: '08:00', isNightShift: false },
    { code: 'JOUR_0830', name: 'Jour — 08h30', expectedArrivalTime: '08:30', isNightShift: false },
    { code: 'JOUR_0900', name: 'Jour — 09h00', expectedArrivalTime: '09:00', isNightShift: false },
    { code: 'NUIT_2000', name: 'Nuit — 20h00', expectedArrivalTime: '20:00', isNightShift: true },
  ]

  const groups: Record<string, string> = {}
  for (const g of groupDefs) {
    const r = await prisma.scheduleGroup.upsert({
      where: { code: g.code },
      update: { name: g.name, expectedArrivalTime: g.expectedArrivalTime },
      create: g,
    })
    groups[g.code] = r.id
    console.log(`  Groupe : ${g.name}`)
  }

  // ---- Utilisateurs ----
  type UserDef = {
    username: string
    firstName: string
    lastName: string
    role: Role
    buCode?: string
    poleCode?: string
    groupCode?: string
    individualExpectedArrivalTime?: string
  }

  const userDefs: UserDef[] = [
    // Direction
    { username: 'CTO', firstName: 'Franck-Emmanuel', lastName: 'OUFFOUET', role: 'CTO_ADMIN', buCode: 'DT', groupCode: 'JOUR_0830' },
    { username: 'PDG', firstName: 'Fabrice', lastName: 'PIOFRET', role: 'PDG', buCode: 'DG', individualExpectedArrivalTime: '08:30' },
    { username: 'DAF', firstName: 'Matirangue', lastName: 'SANOGO', role: 'DAF', buCode: 'DAF', groupCode: 'JOUR_0800' },
    // Responsables BU
    { username: 'RBU_INFO', firstName: 'Stephen', lastName: 'KOUAKOU', role: 'RESPONSABLE_BU', buCode: 'INFO', groupCode: 'JOUR_0830' },
    { username: 'RBU_EREP', firstName: 'Edmond', lastName: 'KONAN', role: 'RESPONSABLE_BU', buCode: 'EREP', groupCode: 'JOUR_0830' },
    { username: 'RBU_SCI', firstName: 'Appolon', lastName: 'DOGO', role: 'RESPONSABLE_BU', buCode: 'SCI', groupCode: 'JOUR_0830' },
    { username: 'RBU_ANALYSES', firstName: 'Joël', lastName: 'TCHETEHO', role: 'RESPONSABLE_BU', buCode: 'ANALYSES', groupCode: 'JOUR_0830' },
    // Responsables Pôle
    { username: 'POLE_PRESSE_JOUR', firstName: 'Jefferson', lastName: 'AGBO', role: 'RESPONSABLE_POLE', buCode: 'INFO', poleCode: 'POLE_PRESSE_JOUR', groupCode: 'JOUR_0830' },
    { username: 'POLE_NUIT', firstName: 'Jean-Charles', lastName: 'ANOUGBA', role: 'RESPONSABLE_POLE', buCode: 'INFO', poleCode: 'POLE_NUIT', groupCode: 'NUIT_2000' },
    { username: 'POLE_TVRADIO', firstName: 'Abel', lastName: "N'DRI", role: 'RESPONSABLE_POLE', buCode: 'INFO', poleCode: 'POLE_TVRADIO', groupCode: 'JOUR_0830' },
    // Consultants INFO
    { username: 'CONS_PJ_1', firstName: 'Consultant', lastName: 'Presse Jour 1', role: 'CONSULTANT', buCode: 'INFO', poleCode: 'POLE_PRESSE_JOUR', groupCode: 'JOUR_0900' },
    { username: 'CONS_NUIT_1', firstName: 'Consultant', lastName: 'Nuit 1', role: 'CONSULTANT', buCode: 'INFO', poleCode: 'POLE_NUIT', groupCode: 'NUIT_2000' },
    { username: 'CONS_TVR_1', firstName: 'Consultant', lastName: 'TV Radio 1', role: 'CONSULTANT', buCode: 'INFO', poleCode: 'POLE_TVRADIO', groupCode: 'JOUR_0900' },
    // EREP
    { username: 'ANGE_KAPET', firstName: 'Ange', lastName: 'KAPET', role: 'CONSULTANT', buCode: 'EREP', groupCode: 'JOUR_0900' },
    { username: 'STAG_EREP_1', firstName: 'Stagiaire', lastName: 'E-Réputation 1', role: 'STAGIAIRE', buCode: 'EREP', groupCode: 'JOUR_0900' },
    // SCI
    { username: 'LILIANE_KONAN', firstName: 'Liliane', lastName: 'KONAN', role: 'CONSULTANT', buCode: 'SCI', groupCode: 'JOUR_0900' },
    { username: 'ANDREAS_BONI', firstName: 'Andréas', lastName: 'BONI', role: 'CONSULTANT', buCode: 'SCI', poleCode: 'POLE_QSC', groupCode: 'JOUR_0900' },
    // Analyses
    { username: 'ME_KOUAKOU', firstName: 'Marie-Emmanuelle', lastName: 'KOUAKOU', role: 'CONSULTANT', buCode: 'ANALYSES', groupCode: 'JOUR_0900' },
    { username: 'JOSEPH_TANO', firstName: 'Joseph', lastName: 'TANO', role: 'CONSULTANT', buCode: 'ANALYSES', groupCode: 'JOUR_0900' },
    { username: 'HENRI_AMAN', firstName: 'Henri-Emmanuel', lastName: 'AMAN', role: 'CONSULTANT', buCode: 'ANALYSES', groupCode: 'JOUR_0900' },
    // DT
    { username: 'STAG_TECH_1', firstName: 'Stagiaire', lastName: 'Technique 1', role: 'STAGIAIRE', buCode: 'DT', poleCode: 'POLE_IA_DEV', groupCode: 'JOUR_0900' },
    { username: 'GLENN_BOLDCODE', firstName: 'Glenn', lastName: 'Boldcode', role: 'PRESTATAIRE', buCode: 'DT', poleCode: 'POLE_IA_DEV', individualExpectedArrivalTime: '10:00' },
  ]

  for (const u of userDefs) {
    const fullName = `${u.firstName} ${u.lastName}`
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        fullName,
        scheduleGroupId: u.groupCode ? groups[u.groupCode] : null,
        individualExpectedArrivalTime: u.individualExpectedArrivalTime ?? null,
      },
      create: {
        username: u.username,
        passwordHash: pwd,
        firstName: u.firstName,
        lastName: u.lastName,
        fullName,
        role: u.role,
        businessUnitId: u.buCode ? bus[u.buCode] : undefined,
        poleId: u.poleCode ? poles[u.poleCode] : undefined,
        scheduleGroupId: u.groupCode ? groups[u.groupCode] : undefined,
        individualExpectedArrivalTime: u.individualExpectedArrivalTime,
      },
    })
    console.log(`  ${u.username} — ${u.role}`)
  }

  // ---- Onglets par BU (créés par le CTO) ----
  const cto = await prisma.user.findUnique({ where: { username: 'CTO' }, select: { id: true } })
  if (!cto) throw new Error('CTO user not found')

  type TabDef = { name: string; url: string; icon: string; color?: string; description?: string }

  const tabsByBu: Record<string, TabDef[]> = {
    INFO: [
      { name: 'Google News', url: 'https://news.google.com', icon: '📰', color: '#4285F4', description: 'Flux actualités Google' },
      { name: 'Google Alertes', url: 'https://www.google.fr/alerts', icon: '🔔', color: '#34A853', description: 'Alertes médias configurées' },
      { name: 'YouTube', url: 'https://www.youtube.com', icon: '▶️', color: '#FF0000', description: 'Veille vidéo' },
      { name: 'X / Twitter', url: 'https://x.com', icon: '✖️', color: '#000000', description: 'Réseau social X' },
    ],
    EREP: [
      { name: 'X / Twitter', url: 'https://x.com', icon: '✖️', color: '#000000', description: 'Suivi mentions X' },
      { name: 'Facebook', url: 'https://www.facebook.com', icon: '📘', color: '#1877F2', description: 'Suivi Facebook' },
      { name: 'LinkedIn', url: 'https://www.linkedin.com', icon: '💼', color: '#0A66C2', description: 'Veille LinkedIn' },
      { name: 'Google Alertes', url: 'https://www.google.fr/alerts', icon: '🔔', color: '#34A853', description: 'Alertes e-réputation' },
    ],
    SCI: [
      { name: 'Google Drive', url: 'https://drive.google.com', icon: '📁', color: '#4285F4', description: 'Documents partagés' },
      { name: 'Gmail', url: 'https://mail.google.com', icon: '✉️', color: '#EA4335', description: 'Messagerie' },
      { name: 'Trello', url: 'https://trello.com', icon: '📋', color: '#0079BF', description: 'Gestion de projets' },
      { name: 'Notion', url: 'https://notion.so', icon: '📝', color: '#000000', description: 'Base de connaissances' },
    ],
    ANALYSES: [
      { name: 'Google Drive', url: 'https://drive.google.com', icon: '📁', color: '#4285F4', description: 'Rapports et analyses' },
      { name: 'Looker Studio', url: 'https://lookerstudio.google.com', icon: '📊', color: '#4285F4', description: 'Tableaux de bord' },
      { name: 'Google News', url: 'https://news.google.com', icon: '📰', color: '#4285F4', description: 'Sources média' },
      { name: 'YouTube', url: 'https://www.youtube.com', icon: '▶️', color: '#FF0000', description: 'Veille audiovisuelle' },
    ],
    DT: [
      { name: 'GitHub', url: 'https://github.com', icon: '🐙', color: '#24292E', description: 'Dépôts de code' },
      { name: 'Vercel', url: 'https://vercel.com', icon: '▲', color: '#000000', description: 'Déploiements frontend' },
      { name: 'OVH', url: 'https://www.ovhcloud.com', icon: '☁️', color: '#123F6D', description: 'Infrastructure serveurs' },
    ],
    DAF: [
      { name: 'Google Drive', url: 'https://drive.google.com', icon: '📁', color: '#4285F4', description: 'Documents financiers' },
      { name: 'Gmail', url: 'https://mail.google.com', icon: '✉️', color: '#EA4335', description: 'Messagerie DAF' },
      { name: 'Excel Online', url: 'https://www.office.com/launch/excel', icon: '📗', color: '#217346', description: 'Tableaux comptables' },
    ],
  }

  let tabCount = 0
  for (const [buCode, tabs] of Object.entries(tabsByBu)) {
    const buId = bus[buCode]
    for (const tab of tabs) {
      await prisma.portalTab.upsert({
        where: { businessUnitId_url: { businessUnitId: buId, url: tab.url } },
        update: { name: tab.name, icon: tab.icon, color: tab.color, description: tab.description },
        create: {
          name: tab.name,
          url: tab.url,
          icon: tab.icon,
          color: tab.color,
          description: tab.description,
          businessUnitId: buId,
          createdById: cto.id,
          isActive: true,
        },
      })
      tabCount++
      console.log(`  Onglet [${buCode}] : ${tab.name}`)
    }
  }

  const stats = {
    users: userDefs.length,
    bus: buDefs.length,
    poles: poleDefs.length,
    groups: groupDefs.length,
    tabs: tabCount,
  }
  console.log(`\nSeed terminé : ${stats.users} utilisateurs, ${stats.bus} BU, ${stats.poles} pôles, ${stats.groups} groupes, ${stats.tabs} onglets.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
