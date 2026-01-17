import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ImageGenerationModule } from './image-generation/image-generation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ImageGenerationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
