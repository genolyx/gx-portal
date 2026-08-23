import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * External create-order body.
 *
 * `params` stays a plain object (no ValidateNested) so ValidationPipe whitelist
 * does not strip daemon fields that are not listed on a nested DTO.
 */
export class ExternalCreateOrderDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() work_dir?: string;

  /** Remote FASTQ URLs — downloaded into shared FASTQ dirs (URL wins over path). */
  @IsOptional() @IsString() fastq_r1_url?: string;
  @IsOptional() @IsString() fastq_r2_url?: string;

  /** Absolute paths already on shared storage. */
  @IsOptional() @IsString() fastq_r1_path?: string;
  @IsOptional() @IsString() fastq_r2_path?: string;

  /** If true, start the pipeline after save. Default false (draft). */
  @IsOptional() @IsBoolean() start?: boolean;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
