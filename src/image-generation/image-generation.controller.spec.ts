import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ImageGenerationController } from './image-generation.controller';
import {
  ImageGenerationService,
  GeneratedImage,
} from './image-generation.service';
import { GenerateImageDto, AnimeStyle, AspectRatio } from './dto/generate-image.dto';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

describe('ImageGenerationController', () => {
  let controller: ImageGenerationController;
  let mockService: Partial<ImageGenerationService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockService = {
      generateAnimeIllustration: jest.fn(),
      generateAndSave: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImageGenerationController],
      providers: [
        {
          provide: ImageGenerationService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ImageGenerationController>(ImageGenerationController);
  });

  // ==========================================
  // generateImage Tests (2 tests)
  // ==========================================
  describe('generateImage', () => {
    it('should return success response with image data', async () => {
      const mockGeneratedImage: GeneratedImage = {
        base64: 'mockBase64Data',
        mimeType: 'image/png',
        prompt: 'test prompt',
        revisedPrompt: 'revised prompt',
      };

      (mockService.generateAnimeIllustration as jest.Mock).mockResolvedValue(
        mockGeneratedImage,
      );

      const dto: GenerateImageDto = { prompt: 'a cute cat' };
      const result = await controller.generateImage(dto);

      expect(result).toEqual({
        success: true,
        data: mockGeneratedImage,
      });
      expect(mockService.generateAnimeIllustration).toHaveBeenCalledWith(dto);
    });

    it('should propagate error from service', async () => {
      const error = new HttpException(
        'Failed to generate image',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      (mockService.generateAnimeIllustration as jest.Mock).mockRejectedValue(
        error,
      );

      const dto: GenerateImageDto = { prompt: 'test' };

      await expect(controller.generateImage(dto)).rejects.toThrow(HttpException);
      await expect(controller.generateImage(dto)).rejects.toThrow(
        'Failed to generate image',
      );
    });
  });

  // ==========================================
  // generateAndSave Tests (2 tests)
  // ==========================================
  describe('generateAndSave', () => {
    it('should return success response with filePath and url', async () => {
      const mockSaveResult = {
        filePath: '/path/to/anime_123456.png',
        url: '/images/anime_123456.png',
      };

      (mockService.generateAndSave as jest.Mock).mockResolvedValue(
        mockSaveResult,
      );

      const dto: GenerateImageDto = { prompt: 'a warrior' };
      const result = await controller.generateAndSave(dto);

      expect(result).toEqual({
        success: true,
        data: mockSaveResult,
      });
      expect(mockService.generateAndSave).toHaveBeenCalledWith(dto);
    });

    it('should propagate error from service', async () => {
      const error = new HttpException(
        'Disk write failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      (mockService.generateAndSave as jest.Mock).mockRejectedValue(error);

      const dto: GenerateImageDto = { prompt: 'test' };

      await expect(controller.generateAndSave(dto)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.generateAndSave(dto)).rejects.toThrow(
        'Disk write failed',
      );
    });
  });

  // ==========================================
  // getAvailableStyles Tests (2 tests)
  // ==========================================
  describe('getAvailableStyles', () => {
    it('should return all anime styles', () => {
      const result = controller.getAvailableStyles();

      expect(result.styles).toBe(AnimeStyle);
      expect(result.styles.MODERN).toBe('modern anime style');
      expect(result.styles.CLASSIC).toBe('classic 90s anime style');
      expect(result.styles.CHIBI).toBe('chibi anime style');
      expect(result.styles.GHIBLI).toBe('studio ghibli style');
    });

    it('should have styles property in response', () => {
      const result = controller.getAvailableStyles();

      expect(result).toHaveProperty('styles');
      expect(Object.keys(result.styles).length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // getAspectRatios Tests (2 tests)
  // ==========================================
  describe('getAspectRatios', () => {
    it('should return all aspect ratios', () => {
      const result = controller.getAspectRatios();

      expect(result.aspectRatios).toBe(AspectRatio);
      expect(result.aspectRatios.SQUARE).toBe('1:1');
      expect(result.aspectRatios.PORTRAIT).toBe('9:16');
      expect(result.aspectRatios.LANDSCAPE).toBe('16:9');
      expect(result.aspectRatios.WIDE).toBe('4:3');
      expect(result.aspectRatios.TALL).toBe('3:4');
    });

    it('should have aspectRatios property in response', () => {
      const result = controller.getAspectRatios();

      expect(result).toHaveProperty('aspectRatios');
      expect(Object.keys(result.aspectRatios).length).toBe(5);
    });
  });

  // ==========================================
  // getImage Tests (2 tests)
  // ==========================================
  describe('getImage', () => {
    let mockResponse: {
      status: jest.Mock;
      json: jest.Mock;
      setHeader: jest.Mock;
      sendFile: jest.Mock;
    };

    beforeEach(() => {
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
        sendFile: jest.fn().mockReturnThis(),
      };
    });

    it('should return 404 if file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await controller.getImage('nonexistent.png', mockResponse as any);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Image not found',
      });
    });

    it('should serve file with correct content-type for png', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await controller.getImage('test.png', mockResponse as any);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/png',
      );
      expect(mockResponse.sendFile).toHaveBeenCalled();
    });

    it('should serve file with correct content-type for jpg', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await controller.getImage('test.jpg', mockResponse as any);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/jpeg',
      );
      expect(mockResponse.sendFile).toHaveBeenCalled();
    });

    it('should serve file with correct content-type for webp', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await controller.getImage('test.webp', mockResponse as any);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/webp',
      );
      expect(mockResponse.sendFile).toHaveBeenCalled();
    });

    it('should fallback to image/png for unknown extension', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await controller.getImage('test.unknown', mockResponse as any);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/png',
      );
      expect(mockResponse.sendFile).toHaveBeenCalled();
    });
  });
});
