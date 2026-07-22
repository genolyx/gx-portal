import { Module } from '@nestjs/common';
import { DaemonModule } from '../daemon/daemon.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [DaemonModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
