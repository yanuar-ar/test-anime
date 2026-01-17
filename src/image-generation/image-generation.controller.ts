import {
  Controller,
  Post,
  Body,
  Get,
  Res,
  Param,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ImageGenerationService, GeneratedImage, HealthCheckResult } from './image-generation.service';
import { GenerateImageDto, AnimeStyle, AspectRatio } from './dto/generate-image.dto';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/images')
export class ImageGenerationController {
  constructor(private readonly imageGenerationService: ImageGenerationService) {}

  @Post('generate')
  async generateImage(@Body() dto: GenerateImageDto): Promise<{
    success: boolean;
    data: GeneratedImage;
  }> {
    const result = await this.imageGenerationService.generateAnimeIllustration(dto);
    return {
      success: true,
      data: result,
    };
  }

  @Post('generate-and-save')
  async generateAndSave(@Body() dto: GenerateImageDto): Promise<{
    success: boolean;
    data: { filePath: string; url: string };
  }> {
    const result = await this.imageGenerationService.generateAndSave(dto);
    return {
      success: true,
      data: result,
    };
  }

  @Get('styles')
  getAvailableStyles(): { styles: typeof AnimeStyle } {
    return { styles: AnimeStyle };
  }

  @Get('aspect-ratios')
  getAspectRatios(): { aspectRatios: typeof AspectRatio } {
    return { aspectRatios: AspectRatio };
  }

  @Get('health')
  async checkHealth(): Promise<HealthCheckResult> {
    return this.imageGenerationService.checkHealth();
  }

  @Get(':filename')
  async getImage(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(process.cwd(), 'generated-images', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Image not found',
      });
    }

    const extension = path.extname(filename).slice(1);
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    };

    res.setHeader('Content-Type', mimeTypes[extension] || 'image/png');
    res.sendFile(filePath);
  }
}
