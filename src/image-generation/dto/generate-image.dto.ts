import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum AspectRatio {
  SQUARE = '1:1',
  PORTRAIT = '9:16',
  LANDSCAPE = '16:9',
  WIDE = '4:3',
  TALL = '3:4',
}

export enum AnimeStyle {
  MODERN = 'modern anime style',
  CLASSIC = 'classic 90s anime style',
  CHIBI = 'chibi anime style',
  REALISTIC = 'semi-realistic anime style',
  GHIBLI = 'studio ghibli style',
  SHONEN = 'shonen anime style',
  SHOUJO = 'shoujo anime style',
}

export class GenerateImageDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  @IsEnum(AnimeStyle)
  style?: AnimeStyle = AnimeStyle.MODERN;

  @IsOptional()
  @IsEnum(AspectRatio)
  aspectRatio?: AspectRatio = AspectRatio.SQUARE;

  @IsOptional()
  @IsString()
  negativePrompt?: string;
}
