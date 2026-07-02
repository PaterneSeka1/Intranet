import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  health(): { status: string; timestamp: string; version: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0-module1',
    }
  }
}
