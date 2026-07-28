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
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    browser.on('disconnected', () => {
      this.browser = undefined
    })
    return browser
  }
}
