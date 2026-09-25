import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import puppeteer, { Browser, Page } from 'puppeteer'

/**
 * Une seule instance Chromium pour toute la vie du process API — relancer un
 * navigateur complet à chaque génération de PDF serait trop coûteux en CPU/RAM.
 */
@Injectable()
export class PdfBrowserService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfBrowserService.name)
  private browser?: Browser
  private launching?: Promise<Browser>

  async onModuleInit() {
    // Pré-lancement opportuniste : un Chromium absent ou bloqué ne doit pas empêcher
    // toute l'API de démarrer — seule la génération de PDF échouera, avec une erreur claire.
    try {
      await this.ensureBrowser()
    } catch (err) {
      this.logger.error(
        `Chromium indisponible au démarrage, les exports PDF échoueront tant qu'il ne l'est pas : ${(err as Error).message}`
      )
    }
  }

  async onModuleDestroy() {
    await this.browser?.close()
  }

  async getPage(): Promise<Page> {
    const browser = await this.ensureBrowser()
    return browser.newPage()
  }

  // Mutualise les lancements concurrents : deux exports simultanés après un crash de
  // Chromium ne doivent pas démarrer deux navigateurs.
  private async ensureBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser
    this.launching ??= this.launch().finally(() => {
      this.launching = undefined
    })
    this.browser = await this.launching
    return this.browser
  }

  private async launch(): Promise<Browser> {
    // Sur les postes Windows sous stratégie de contrôle d'application (WDAC/AppLocker),
    // le Chromium téléchargé par Puppeteer dans le cache utilisateur peut être bloqué
    // à l'exécution. PUPPETEER_EXECUTABLE_PATH permet de pointer vers un Chrome/Edge
    // installé (signé, autorisé par la stratégie) à la place.
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    browser.on('disconnected', () => {
      this.browser = undefined
    })
    return browser
  }
}
