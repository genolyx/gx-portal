import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './common/db.module';
import { DaemonModule } from './daemon/daemon.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewModule } from './review/review.module';
import { ReportModule } from './report/report.module';
import { SystemModule } from './system/system.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { LabsModule } from './labs/labs.module';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DbModule,      // global — provides DbService to all
    DaemonModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    LabsModule,
    OrdersModule,
    ReviewModule,
    ReportModule,
    SystemModule,
    CatalogModule,
  ],
})
export class AppModule {}
