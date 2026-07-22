import { api } from './client';

export interface BrowseItem {
  kind: 'dir' | 'file';
  name: string;
  rel_path?: string;
  abs_path?: string;
}

export interface BrowseResponse {
  root: string;
  rel_path?: string;
  parent_rel?: string;
  parent_abs?: string;
  current_abs?: string;
  root_exists?: boolean;
  service_code?: string;
  items?: BrowseItem[];
  hint?: string;
}

export const browseApi = {
  fastq: (path: string, serviceCode: string) =>
    api.get<BrowseResponse>(`/browse/fastq?path=${encodeURIComponent(path)}&service_code=${encodeURIComponent(serviceCode)}`),

  bamCsv: (params: { path?: string; service_code: string; abs_path?: string; file_ext?: 'csv' | 'bam' }) => {
    const qs = new URLSearchParams();
    qs.set('path', params.path ?? '');
    qs.set('service_code', params.service_code);
    if (params.abs_path) qs.set('abs_path', params.abs_path);
    if (params.file_ext) qs.set('file_ext', params.file_ext);
    return api.get<BrowseResponse>(`/browse/bam-csv?${qs.toString()}`);
  },
};
