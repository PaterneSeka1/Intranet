import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import puppeteer, { Browser, Page } from 'puppeteer'

/**
 * Une seule instance Chromium pour toute la vie du process API — relancer un
 * navigateur complet à chaque génération de PDF serait trop coûteux en CPU/RAM.
 */
@Injectable()
export class PdfBrowserService implements OnModuleInit, OnModuleDestroy {
  private browser?: Browser

  async onModuleInit() {
    this.browser = await this.launch()
  }

  async onModuleDestroy() {
    await this.browser?.close()
  }

  async getPage(): Promise<Page> {
    if (!this.browser?.connected) {
      this.browser = await this.launch()
    }
    return this.browser.newPage()
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
