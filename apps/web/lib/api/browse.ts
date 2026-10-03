import { ApiError, api, API_BASE } from './client';

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

export interface FastqUploadResult {
  abs_path: string;
  name: string;
  size: number;
  rel_path: string;
}

const FASTQ_NAME = /\.(fastq|fq)(\.gz)?$/i;

export function isFastqFilename(name: string): boolean {
  return FASTQ_NAME.test(name);
}

/** Stream one FASTQ to the service directory. Progress is bytes sent. */
export function uploadFastqFile(
  serviceCode: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<FastqUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const qs = new URLSearchParams({
      service_code: serviceCode,
      filename: file.name,
    });
    xhr.open('POST', `${API_BASE}/browse/fastq/upload?${qs.toString()}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () => {
      let message = xhr.responseText || `HTTP ${xhr.status}`;
      try {
        const json = JSON.parse(xhr.responseText) as { message?: string; detail?: string; abs_path?: string };
        if (xhr.status >= 200 && xhr.status < 300 && json.abs_path) {
          resolve(json as FastqUploadResult);
          return;
        }
        message = json.message || json.detail || message;
      } catch { /* keep raw text */ }
      if (xhr.status === 401 && typeof window !== 'undefined') {
        window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
      }
      reject(new ApiError(xhr.status, message));
    };
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed'));
    xhr.send(file);
  });
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
