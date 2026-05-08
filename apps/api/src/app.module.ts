import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { CacheModule } from '@nestjs/cache-manager'
import { BullModule } from '@nestjs/bull'
import { createKeyv, Keyv } from '@keyv/redis'
import { CacheableMemory } from 'cacheable'
import { PrismaModule } from './prisma/prisma.module'
import { CardsModule } from './modules/cards/cards.module'
import { SetsModule } from './modules/sets/sets.module'
import { MarketModule } from './modules/market/market.module'
import { PortfolioModule } from './modules/portfolio/portfolio.module'
import { AlertsModule } from './modules/alerts/alerts.module'
import { UsersModule } from './modules/users/users.module'
import { AiModule } from './modules/ai/ai.module'
import { ScrapingModule } from './modules/scraping/scraping.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { AuthModule } from './modules/auth/auth.module'

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 100 },
      { name: 'long', ttl: 3_600_000, limit: 1000 },
    ]),

    // Cron jobs
    ScheduleModule.forRoot(),

    // Cache (Redis)
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [
          new CacheableMemory({ ttl: 30_000, lruSize: 5000 }),
          createKeyv(config.get('REDIS_URL', 'redis://localhost:6379')),
        ],
      }),
    }),

    // Bull queues (Redis)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get('REDIS_URL', 'redis://localhost:6379'),
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }),
    }),

    // Core modules
    PrismaModule,
    AuthModule,
    UsersModule,
    CardsModule,
    SetsModule,
    MarketModule,
    PortfolioModule,
    AlertsModule,
    AiModule,
    ScrapingModule,
    PaymentsModule,
  ],
})
export class AppModule {}
