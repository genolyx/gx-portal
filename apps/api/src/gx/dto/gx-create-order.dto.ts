import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class GxOrganizationDto {
  @IsString() type!: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() hospital_name?: string;
  @IsOptional() @IsString() doctor?: string;
}

export class GxSampleDto {
  @IsOptional() @IsString() sample_id?: string;
  @IsOptional() @IsString() medical_record_id?: string;
  @IsOptional() @IsString() sample_collected_at?: string;
  @IsString() fastq_r1_url!: string;
  @IsString() fastq_r2_url!: string;
}

export class GxCallbackDto {
  @IsString() report_url!: string;
  @IsOptional() @IsString() status_url?: string;
}

export class GxCreateOrderDto {
  @IsString() source!: string;
  @IsString() order_id!: string;
  @IsString() service_code!: string;
  @IsOptional() @IsString() schema_version?: string;

  @ValidateNested()
  @Type(() => GxOrganizationDto)
  organization!: GxOrganizationDto;

  @ValidateNested()
  @Type(() => GxSampleDto)
  sample!: GxSampleDto;

  @IsOptional()
  @IsObject()
  service_data?: Record<string, unknown>;

  @ValidateNested()
  @Type(() => GxCallbackDto)
  callback!: GxCallbackDto;
}
