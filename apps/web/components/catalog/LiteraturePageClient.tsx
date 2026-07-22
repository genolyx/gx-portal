'use client';

import { useCallback, useEffect, useState } from 'react';
import { catalogApi, type LiteratureArticle } from '../../lib/api/catalog';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import styles from './Catalog.module.css';

const PER_PAGE = 20;

export function LiteraturePageClient() {
  const [articles, setArticles] = useState<LiteratureArticle[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [q, setQ]               = useState('');
  const [sort, setSort]         = useState('cached_at');
  const [loading, setLoading]   = useState(true);
  const [dbMissing, setDbMissing] = useState(false);
  const [stats, setStats]       = useState<{ total?: number; by_gene?: Record<string, number> } | null>(null);

  // Manual search
  const [gene, setGene]         = useState('');
  const [hgvsc, setHgvsc]       = useState('');
  const [hgvsp, setHgvsp]       = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [searchResult, setSearchResult] = useState<LiteratureArticle[]>([]);

  // Detail modal
  const [detail, setDetail]     = useState<LiteratureArticle | null>(null);

  const loadStats = useCallback(async () => {
    try { const s = await catalogApi.getStats(); setStats(s); }
    catch { /* ignore */ }
  }, []);

  const load = useCallback(async (p = page, query = q, sortBy = sort) => {
    setLoading(true);
    try {
      const res = await catalogApi.getArticles({ page: p, per_page: PER_PAGE, q: query || undefined, sort: sortBy });
      setArticles(res.articles ?? []);
      setTotal(res.total ?? 0);
      setDbMissing(res.db_missing ?? false);
    } catch {
      setArticles([]); setTotal(0);
    } finally { setLoading(false); }
  }, [page, q, sort]);

  useEffect(() => { load(1, q, sort); loadStats(); }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gene.trim()) { setSearchMsg('Gene is required.'); return; }
    setSearching(true); setSearchMsg('Searching PubMed…'); setSearchResult([]);
    try {
      const res = await catalogApi.search({ gene: gene.trim(), hgvsc: hgvsc.trim() || undefined, hgvsp: hgvsp.trim() || undefined, force_refresh: forceRefresh });
      setSearchResult(res.articles ?? []);
      setSearchMsg(`Found ${res.total ?? res.articles?.length ?? 0} articles`);
      await load(1, q, sort);
      await loadStats();
    } catch (err) {
      setSearchMsg(err instanceof Error ? err.message : 'Search failed');
    } finally { setSearching(false); }
  };

  const handleDelete = async (pmid: string) => {
    if (!confirm(`Remove article ${pmid} from cache?`)) return;
    try { await catalogApi.deleteArticle(pmid); await load(page, q, sort); await loadStats(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear ALL literature cache? This cannot be undone.')) return;
    try { await catalogApi.clearCache(); await load(1, q, sort); await loadStats(); }
    catch (err) { alert(err instanceof Error ? err.message : 'Clear failed'); }
  };

  const applyFilter = () => { setPage(1); load(1, q, sort); };
  const totalPages  = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <PageHeader
        title="Literature Cache"
        description="PubMed articles cached from variant searches."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="ghost" onClick={() => { load(1, q, sort); loadStats(); }} loading={loading}>↻ Refresh</Button>
            <Button size="sm" variant="ghost" onClick={handleClearAll}>Clear All</Button>
          </div>
        }
      />

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span className={styles.pill}>{stats.total ?? 0} articles cached</span>
          {stats.by_gene && Object.entries(stats.by_gene).slice(0, 8).map(([g, c]) => (
            <span key={g} className={styles.pill}>{g}: {c}</span>
          ))}
        </div>
      )}

      {dbMissing && (
        <div className={styles.infoBox}>
          📭 Literature database not yet initialised. Use the Search panel below to cache articles for variants — the DB will be created automatically on first search.
        </div>
      )}

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, abstract, PMID, author…"
          className={styles.input} style={{ flex: 1, minWidth: 220 }}
          onKeyDown={(e) => e.key === 'Enter' && applyFilter()} />
        <select value={sort} onChange={(e) => { setSort(e.target.value); load(1, q, e.target.value); }} className={styles.input}>
          <option value="cached_at">Cached Date</option>
          <option value="pub_date">Pub Date</option>
        </select>
      </div>

      {/* Manual search panel */}
      <details className={styles.searchDetails} style={{ marginBottom: 16 }}>
        <summary className={styles.searchSummary}>🔍 Search literature for a variant</summary>
        <form onSubmit={handleSearch} style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className={styles.label}>Gene *</label>
            <input value={gene} onChange={(e) => setGene(e.target.value)} placeholder="e.g. BRCA2" className={styles.input} style={{ width: 120 }} />
          </div>
          <div>
            <label className={styles.label}>HGVS.c</label>
            <input value={hgvsc} onChange={(e) => setHgvsc(e.target.value)} placeholder="e.g. c.5266dupC" className={styles.input} style={{ width: 160 }} />
          </div>
          <div>
            <label className={styles.label}>HGVS.p</label>
            <input value={hgvsp} onChange={(e) => setHgvsp(e.target.value)} placeholder="e.g. p.Gln1756fs" className={styles.input} style={{ width: 160 }} />
          </div>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={forceRefresh} onChange={(e) => setForceRefresh(e.target.checked)} /> Force refresh
          </label>
          <Button size="sm" variant="primary" type="submit" loading={searching}>Search &amp; Cache</Button>
          {searchMsg && <span className={styles.muted}>{searchMsg}</span>}
        </form>
        {searchResult.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <ArticleTable articles={searchResult} onDelete={handleDelete} onDetail={setDetail} compact />
          </div>
        )}
      </details>

      {/* Articles table */}
      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : articles.length === 0 && !dbMissing ? (
        <p className={styles.muted}>No articles in cache.</p>
      ) : (
        <ArticleTable articles={articles} onDelete={handleDelete} onDetail={setDetail} />
      )}

      {/* Pagination */}
      {total > PER_PAGE && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <Button size="sm" variant="ghost" onClick={() => { setPage((p) => { const n = p - 1; load(n, q, sort); return n; })} } disabled={page <= 1}>‹ Prev</Button>
          <span className={styles.muted}>Page {page} / {totalPages} · {total} articles</span>
          <Button size="sm" variant="ghost" onClick={() => { setPage((p) => { const n = p + 1; load(n, q, sort); return n; })} } disabled={page >= totalPages}>Next ›</Button>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className={styles.modalOverlay} onClick={() => setDetail(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Article Detail</h3>
              <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>✕</Button>
            </div>
            <div style={{ padding: '14px 16px', maxHeight: '60vh', overflowY: 'auto', fontSize: 13, lineHeight: 1.7 }}>
              <p><strong>PMID:</strong> <a href={`https://pubmed.ncbi.nlm.nih.gov/${detail.pmid}`} target="_blank" rel="noreferrer">{detail.pmid} ↗</a></p>
              {detail.title   && <p><strong>Title:</strong> {detail.title}</p>}
              {detail.journal && <p><strong>Journal:</strong> {detail.journal}</p>}
              {detail.pub_date && <p><strong>Published:</strong> {detail.pub_date}</p>}
              {detail.authors && <p><strong>Authors:</strong> {(detail.authors as string[]).join(', ')}</p>}
              {detail.abstract && <p><strong>Abstract:</strong> {detail.abstract}</p>}
              {detail.genes && <p><strong>Genes:</strong> {(detail.genes as string[]).join(', ')}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleTable({
  articles, onDelete, onDetail, compact,
}: {
  articles: LiteratureArticle[];
  onDelete: (pmid: string) => void;
  onDetail: (a: LiteratureArticle) => void;
  compact?: boolean;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>PMID</th>
            <th>Title</th>
            {!compact && <><th>Journal</th><th>Pub Date</th><th>Cached</th></>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {articles.map((a) => (
            <tr key={a.pmid}>
              <td className={styles.mono} style={{ whiteSpace: 'nowrap' }}>
                <a href={`https://pubmed.ncbi.nlm.nih.gov/${a.pmid}`} target="_blank" rel="noreferrer" className={styles.link}>{a.pmid}</a>
              </td>
              <td>
                <button type="button" className={styles.titleBtn} onClick={() => onDetail(a)}>{a.title ?? '—'}</button>
              </td>
              {!compact && (
                <>
                  <td className={styles.muted} style={{ whiteSpace: 'nowrap' }}>{a.journal ?? '—'}</td>
                  <td className={styles.muted} style={{ whiteSpace: 'nowrap' }}>{a.pub_date ?? '—'}</td>
                  <td className={styles.muted} style={{ whiteSpace: 'nowrap' }}>{a.cached_at ? new Date(String(a.cached_at)).toLocaleDateString() : '—'}</td>
                </>
              )}
              <td>
                <Button size="sm" variant="ghost" onClick={() => onDelete(a.pmid)}>✕</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
