import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

const asNumber = ({ value }: { value: unknown }) => {
  if (value === '' || value === null || value === undefined) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
};

/** Nested carrier clinical block (CS / WE / HS). */
export class ExternalCarrierParamsDto {
  @IsOptional() @IsString() test_category?: string;
  @IsOptional() @IsString() package_code?: string;
  @IsOptional() @IsString() patient_name?: string;
  @IsOptional() @IsString() patient_birth?: string;
  @IsOptional() @IsString() patient_gender?: string;
  @IsOptional() @IsString() hospital_name?: string;
  @IsOptional() @IsString() doctor?: string;
  @IsOptional() @IsString() affected?: string;
  @IsOptional() @IsString() sample_collection_date?: string;
  @IsOptional() @IsString() report_language?: string;
  @IsOptional() @IsString() report_type?: string;
  @IsOptional() @IsString() sample_specimen_type?: string;
  @IsOptional() @IsString() report_mode?: string;
  @IsOptional() @IsString() wes_panel_id?: string;
  @IsOptional() @IsString() capture_panel_id?: string;
  @IsOptional() @IsBoolean() reuse_prior_pipeline_outputs?: boolean;
  @IsOptional() @IsBoolean() include_pgx?: boolean;
}

/** Nested sgNIPT clinical block. */
export class ExternalNiptParamsDto {
  @IsOptional() @IsString() previous_order_id?: string;
  @IsOptional() @IsString() patient_name?: string;
  @IsOptional() @IsString() patient_birth?: string;
  @IsOptional() @IsString() patient_gender?: string;
  @IsOptional() @Transform(asNumber) @IsNumber() gestational_age_weeks?: number;
  @IsOptional() @Transform(asNumber) @IsNumber() gestational_age_days?: number;
  @IsOptional() @Transform(asNumber) @IsNumber() height_cm?: number;
  @IsOptional() @Transform(asNumber) @IsNumber() weight_kg?: number;
  @IsOptional() @IsString() pregnancy_type?: string;
  @IsOptional() @IsString() estimated_delivery_date?: string;
  @IsOptional() @IsString() hospital_name?: string;
  @IsOptional() @IsString() doctor?: string;
  @IsOptional() @IsString() medical_record_id?: string;
  @IsOptional() @IsString() sample_id?: string;
  @IsOptional() @IsString() indication_for_testing?: string;
  @IsOptional() @IsString() sample_collection_date?: string;
  @IsOptional() @IsString() receipt_date?: string;
  @IsOptional() @IsString() package_code?: string;
  @IsOptional() @IsString() report_language?: string;
  @IsOptional() @IsString() report_type?: string;
  @IsOptional() @IsString() sample_specimen_type?: string;
  @IsOptional() @IsString() measurement_method?: string;
  @IsOptional() @IsString() sample_barcode?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() nipt_kit_id?: string;
  @IsOptional() @IsString() sequencing_batch_id?: string;
  @IsOptional() @IsString() control_sample?: string;
  @IsOptional() @IsString() trf_consent?: string;
  @IsOptional() @IsString() show_fetal_gender?: string;
  @IsOptional() @IsString() resample?: string;
}

export class ExternalOrderParamsDto {
  @IsOptional() @IsString() wes_panel_id?: string;
  @IsOptional() @IsString() input_bam?: string;
  @IsOptional() @IsString() input_bam_csv?: string;
  @IsOptional() @IsString() backbone_bed?: string;
  @IsOptional() @IsString() disease_bed?: string;
  @IsOptional() @Transform(asNumber) @IsNumber() max_af?: number;
  @IsOptional() @IsString() hpo_terms?: string;
  @IsOptional() @IsString() gene_filter?: string;
  @IsOptional() @IsBoolean() panel_filter_after_analysis?: boolean;
  @IsOptional() @IsBoolean() include_apoe_pgx?: boolean;
  @IsOptional() @IsString() interpretation_genes_extra?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExternalCarrierParamsDto)
  carrier?: ExternalCarrierParamsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExternalNiptParamsDto)
  nipt?: ExternalNiptParamsDto;
}

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
  @ValidateNested()
  @Type(() => ExternalOrderParamsDto)
  params?: ExternalOrderParamsDto;
}
