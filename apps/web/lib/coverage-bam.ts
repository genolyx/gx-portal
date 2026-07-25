import type { BamTrack } from '@gx-portal/types';

/** Prefer alignment/*.md.bam — matches Portal prioritizeCoverageBamTracks. */
export function prioritizeCoverageBamTracks(tracks: BamTrack[] | undefined | null): BamTrack[] {
  const isSpurious = (rel: string) =>
    [
      'paraphase',
      '/smn',
      'fmr1',
      'tests/resources',
      '/aldy/',
      'node_modules',
      '/.local/lib/',
      '/.venv/',
    ].some((m) => rel.toLowerCase().includes(m));

  let pool = (tracks || []).filter(
    (t) => t && t.has_index && !isSpurious(String(t.rel_path || '')),
  );
  const nonWork = pool.filter((t) => !String(t.rel_path || '').toLowerCase().includes('/work/'));
  if (nonWork.length) pool = nonWork;
  const list = pool.length ? pool : (tracks || []).filter((t) => t && t.has_index);
  return list.slice().sort((a, b) => {
    const score = (rel: string) => {
      const r = String(rel || '').toLowerCase();
      let s = 50;
      if (r.startsWith('alignment/') || r.includes('/alignment/')) s -= 30;
      if (r.endsWith('.md.bam')) s -= 25;
      else if (r.endsWith('.pb.bam')) s -= 20;
      if (r.includes('/work/')) s += 40;
      return s;
    };
    const d = score(a.rel_path) - score(b.rel_path);
    return d !== 0 ? d : String(a.rel_path).localeCompare(String(b.rel_path));
  });
}

export function pickCoverageBamTrack(tracks: BamTrack[] | undefined | null): BamTrack | null {
  return prioritizeCoverageBamTracks(tracks)[0] || null;
}

export function coverageBamIndexRel(meta: BamTrack | null | undefined): string | undefined {
  if (!meta) return undefined;
  if (meta.index_rel_path) return meta.index_rel_path;
  const rel = String(meta.rel_path || '');
  if (!/\.bam$/i.test(rel)) return undefined;
  return `${rel.slice(0, -4)}.bai`;
}
