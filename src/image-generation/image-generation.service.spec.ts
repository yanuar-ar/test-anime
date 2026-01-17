import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ImageGenerationService } from './image-generation.service';
import { GenerateImageDto, AnimeStyle } from './dto/generate-image.dto';
import * as fs from 'fs';

// Mock the @google/genai module
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn(),
    },
  })),
  Modality: {
    TEXT: 'TEXT',
    IMAGE: 'IMAGE',
  },
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('ImageGenerationService', () => {
  let service: ImageGenerationService;
  let mockConfigService: Partial<ConfigService>;
  let mockGenerateContent: jest.Mock;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    mockConfigService = {
      get: jest.fn().mockReturnValue('test-api-key'),
    };

    // Get reference to the mocked generateContent function
    const { GoogleGenAI } = require('@google/genai');
    mockGenerateContent = jest.fn();
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageGenerationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ImageGenerationService>(ImageGenerationService);
  });

  // ==========================================
  // Constructor Tests (2 tests)
  // ==========================================
  describe('Constructor', () => {
    it('should throw error if GOOGLE_API_KEY is not configured', async () => {
      const mockConfigWithoutKey = {
        get: jest.fn().mockReturnValue(undefined),
      };

      await expect(
        Test.createTestingModule({
          providers: [
            ImageGenerationService,
            {
              provide: ConfigService,
              useValue: mockConfigWithoutKey,
            },
          ],
        }).compile(),
      ).rejects.toThrow('GOOGLE_API_KEY is not configured');
    });

    it('should successfully initialize with valid API key', () => {
      expect(service).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalledWith('GOOGLE_API_KEY');
    });
  });

  // ==========================================
  // buildAnimePrompt Tests (5 tests)
  // ==========================================
  describe('buildAnimePrompt', () => {
    it('should build prompt with required fields only', () => {
      const dto: GenerateImageDto = {
        prompt: 'a cute cat',
      };

      // Access private method using type assertion
      const result = (service as any).buildAnimePrompt(dto);

      expect(result).toContain('Create a high-quality anime illustration: a cute cat');
    });

    it('should add default style "modern anime style" if style is not provided', () => {
      const dto: GenerateImageDto = {
        prompt: 'a warrior',
      };

      const result = (service as any).buildAnimePrompt(dto);

      expect(result).toContain('modern anime style');
    });

    it('should use custom style when provided', () => {
      const dto: GenerateImageDto = {
        prompt: 'a samurai',
        style: AnimeStyle.GHIBLI,
      };

      const result = (service as any).buildAnimePrompt(dto);

      expect(result).toContain('studio ghibli style');
      expect(result).not.toContain('modern anime style');
    });

    it('should add quality tags to the prompt', () => {
      const dto: GenerateImageDto = {
        prompt: 'a dragon',
      };

      const result = (service as any).buildAnimePrompt(dto);

      expect(result).toContain('highly detailed');
      expect(result).toContain('vibrant colors');
      expect(result).toContain('professional artwork');
      expect(result).toContain('4k quality');
    });

    it('should add negative prompt when provided', () => {
      const dto: GenerateImageDto = {
        prompt: 'a hero',
        negativePrompt: 'blurry, low quality',
      };

      const result = (service as any).buildAnimePrompt(dto);

      expect(result).toContain('Avoid: blurry, low quality');
    });

    it('should handle special characters in prompt', () => {
      const dto: GenerateImageDto = {
        prompt: 'a hero with "special" <powers> & abilities',
      };

      const result = (service as any).buildAnimePrompt(dto);

      expect(result).toContain('a hero with "special" <powers> & abilities');
    });
  });

  // ==========================================
  // generateAnimeIllustration Tests (5 tests)
  // ==========================================
  describe('generateAnimeIllustration', () => {
    it('should return object with correct structure (base64, mimeType, prompt)', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: 'base64ImageData',
                    mimeType: 'image/png',
                  },
                },
                {
                  text: 'Revised prompt here',
                },
              ],
            },
          },
        ],
      });

      const dto: GenerateImageDto = { prompt: 'test' };
      const result = await service.generateAnimeIllustration(dto);

      expect(result).toHaveProperty('base64', 'base64ImageData');
      expect(result).toHaveProperty('mimeType', 'image/png');
      expect(result).toHaveProperty('prompt');
      expect(result).toHaveProperty('revisedPrompt', 'Revised prompt here');
    });

    it('should throw HttpException if no parts from API', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [],
            },
          },
        ],
      });

      const dto: GenerateImageDto = { prompt: 'test' };

      await expect(service.generateAnimeIllustration(dto)).rejects.toThrow(
        HttpException,
      );
      await expect(service.generateAnimeIllustration(dto)).rejects.toThrow(
        'No image generated from the API',
      );
    });

    it('should throw HttpException if no image data in response', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Only text, no image',
                },
              ],
            },
          },
        ],
      });

      const dto: GenerateImageDto = { prompt: 'test' };

      await expect(service.generateAnimeIllustration(dto)).rejects.toThrow(
        HttpException,
      );
      await expect(service.generateAnimeIllustration(dto)).rejects.toThrow(
        'No image data in response',
      );
    });

    it('should handle API error and wrap in HttpException', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API connection failed'));

      const dto: GenerateImageDto = { prompt: 'test' };

      await expect(service.generateAnimeIllustration(dto)).rejects.toThrow(
        HttpException,
      );
      await expect(service.generateAnimeIllustration(dto)).rejects.toThrow(
        'Failed to generate image: API connection failed',
      );
    });

    it('should fallback to image/png if mimeType is not provided', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: 'base64ImageData',
                    // mimeType not provided
                  },
                },
              ],
            },
          },
        ],
      });

      const dto: GenerateImageDto = { prompt: 'test' };
      const result = await service.generateAnimeIllustration(dto);

      expect(result.mimeType).toBe('image/png');
    });
  });

  // ==========================================
  // generateAndSave Tests (3 tests)
  // ==========================================
  describe('generateAndSave', () => {
    beforeEach(() => {
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: 'base64ImageData',
                    mimeType: 'image/png',
                  },
                },
              ],
            },
          },
        ],
      });
    });

    it('should save file to disk correctly', async () => {
      const dto: GenerateImageDto = { prompt: 'test image' };

      await service.generateAndSave(dto);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[0]).toContain('anime_');
      expect(writeCall[0]).toContain('.png');
      expect(writeCall[1]).toBeInstanceOf(Buffer);
    });

    it('should return correct filePath and url', async () => {
      const dto: GenerateImageDto = { prompt: 'test image' };

      const result = await service.generateAndSave(dto);

      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('url');
      expect(result.filePath).toContain('anime_');
      expect(result.filePath).toContain('.png');
      expect(result.url).toMatch(/^\/images\/anime_\d+\.png$/);
    });

    it('should handle error when write fails', async () => {
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Disk write failed');
      });

      const dto: GenerateImageDto = { prompt: 'test image' };

      await expect(service.generateAndSave(dto)).rejects.toThrow(
        'Disk write failed',
      );
    });
  });
});
