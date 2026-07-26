'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Button,
  Chip,
  Input,
  Label,
  Link,
  ListBox,
  Modal,
  Select,
  Table,
} from '@heroui/react';
import { Trash2 } from 'lucide-react';
import { catalogApi, type LiteratureArticle, type LiteratureStats } from '../../lib/api/catalog';
import { formatPortalDate } from '../../lib/datetime';
import { LabeledCheckbox } from '../ui/LabeledCheckbox';
import { PageHeader } from '../ui/PageHeader';
import { RefreshButton } from '../ui/RefreshButton';

const PER_PAGE = 50;

export function LiteraturePageClient() {
  const searchParams = useSearchParams();
  const [articles, setArticles] = useState<LiteratureArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('cached_at');
  const [loading, setLoading] = useState(true);
  const [dbMissing, setDbMissing] = useState(false);
  const [stats, setStats] = useState<LiteratureStats | null>(null);

  const [gene, setGene] = useState('');
  const [hgvsc, setHgvsc] = useState('');
  const [hgvsp, setHgvsp] = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [searchResult, setSearchResult] = useState<LiteratureArticle[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const [detail, setDetail] = useState<LiteratureArticle | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinkDone = useRef(false);
  const filterReady = useRef(false);

  const loadStats = useCallback(async () => {
    try {
      const s = await catalogApi.getStats();
      setStats(s);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(
    async (p = page, query = q, sortBy = sort, manual = false) => {
      setLoading(true);
      try {
        const res = await catalogApi.getArticles({
          page: p,
          per_page: PER_PAGE,
          q: query || undefined,
          sort: sortBy,
        });
        setArticles(res.articles ?? []);
        setTotal(res.total ?? 0);
        setDbMissing(res.db_missing ?? false);
      } catch (e) {
        setArticles([]);
        setTotal(0);
        if (manual) throw e instanceof Error ? e : new Error('Failed to refresh literature');
      } finally {
        setLoading(false);
      }
    },
    [page, q, sort],
  );

  useEffect(() => {
    void load(1, q, sort, false);
    void loadStats();
  }, []);

  // Debounced cache filter (parity with old portal ~400ms)
  useEffect(() => {
    if (!filterReady.current) {
      filterReady.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      void load(1, q, sort);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Intentionally only q — sort changes call load() directly from the Select handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const runVariantSearch = useCallback(
    async (g: string, c?: string, p?: string, force = false) => {
      if (!g.trim()) {
        setSearchMsg('Gene is required.');
        return;
      }
      setSearching(true);
      setSearchOpen(true);
      setSearchMsg('Searching PubMed…');
      setSearchResult([]);
      try {
        const res = await catalogApi.search({
          gene: g.trim(),
          hgvsc: c?.trim() || undefined,
          hgvsp: p?.trim() || undefined,
          force_refresh: force,
        });
        setSearchResult(res.articles ?? []);
        const n = res.total_found ?? res.total ?? res.articles?.length ?? 0;
        setSearchMsg(`Found ${n} articles${res.from_cache ? ' (cached)' : ''}`);
        await load(1, q, sort);
        await loadStats();
      } catch (err) {
        setSearchMsg(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setSearching(false);
      }
    },
    [load, loadStats, q, sort],
  );

  // Review → Literature deep-link: /literature?gene=&hgvsc=&hgvsp=
  useEffect(() => {
    if (deepLinkDone.current) return;
    const g = searchParams.get('gene');
    if (!g) return;
    deepLinkDone.current = true;
    const c = searchParams.get('hgvsc') ?? '';
    const p = searchParams.get('hgvsp') ?? '';
    setGene(g);
    setHgvsc(c);
    setHgvsp(p);
    setSearchOpen(true);
    void runVariantSearch(g, c, p, false);
  }, [searchParams, runVariantSearch]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await runVariantSearch(gene, hgvsc, hgvsp, forceRefresh);
  };

  const handleDelete = async (pmid: string) => {
    if (!confirm(`Remove article ${pmid} from cache?`)) return;
    try {
      await catalogApi.deleteArticle(pmid);
      await load(page, q, sort);
      await loadStats();
      if (detail?.pmid === pmid) setDetail(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Clear ALL literature cache? This cannot be undone.')) return;
    try {
      await catalogApi.clearCache();
      setPage(1);
      await load(1, q, sort);
      await loadStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Clear failed');
    }
  };

  const openDetail = async (a: LiteratureArticle) => {
    setDetail(a);
    setDetailLoading(true);
    try {
      const full = await catalogApi.getArticle(a.pmid);
      setDetail(full);
    } catch {
      /* keep list row */
    } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const disabled = stats?.enabled === false && !stats.db_missing;

  return (
    <div>
      <PageHeader
        title="Literature Cache"
        description="PubMed articles cached from variant searches."
        actions={
          <div className="flex gap-2">
            <RefreshButton
              variant="ghost"
              label="Refresh"
              successToast="Literature refreshed"
              isLoading={loading}
              onPress={async () => {
                await load(1, q, sort, true);
                await loadStats();
              }}
            />
            <Button size="sm" variant="ghost" onPress={handleClearAll}>
              Clear All
            </Button>
          </div>
        }
      />

      {stats && (
        <div className="flex flex-wrap gap-2 mb-4">
          {disabled ? (
            <Chip size="sm" variant="soft" color="warning">
              <Chip.Label>Literature disabled</Chip.Label>
            </Chip>
          ) : (
            <>
              <Chip size="sm" variant="soft">
                <Chip.Label>{stats.total_articles ?? stats.total ?? 0} articles</Chip.Label>
              </Chip>
              <Chip size="sm" variant="soft">
                <Chip.Label>{stats.unique_genes ?? 0} genes</Chip.Label>
              </Chip>
              <Chip size="sm" variant="soft">
                <Chip.Label>{stats.total_searches ?? 0} searches</Chip.Label>
              </Chip>
            </>
          )}
        </div>
      )}

      {dbMissing && (
        <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm mb-4">
          Literature database not yet initialised. Use the Search panel below to cache articles for
          variants — the DB will be created automatically on first search.
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, abstract, PMID, author…"
          className="flex-1 min-w-[220px]"
        />
        <Select
          selectedKey={sort}
          onSelectionChange={(key) => {
            const next = String(key);
            setSort(next);
            setPage(1);
            void load(1, q, next);
          }}
        >
          <Select.Trigger className="min-w-[140px]">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="cached_at" textValue="Cached Date">
                Cached Date
              </ListBox.Item>
              <ListBox.Item id="pub_date" textValue="Pub Date">
                Pub Date
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <details
        className="rounded-lg border border-border bg-surface-secondary p-4 mb-4"
        open={searchOpen}
        onToggle={(e) => setSearchOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-sm font-medium">
          Search literature for a variant
        </summary>
        <form
          onSubmit={handleSearch}
          className="mt-3 flex flex-wrap gap-3 items-end"
        >
          <div className="flex flex-col gap-1.5">
            <Label>Gene *</Label>
            <Input
              value={gene}
              onChange={(e) => setGene(e.target.value)}
              placeholder="e.g. BRCA2"
              className="w-[120px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>HGVS.c</Label>
            <Input
              value={hgvsc}
              onChange={(e) => setHgvsc(e.target.value)}
              placeholder="e.g. c.5266dupC"
              className="w-[160px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>HGVS.p</Label>
            <Input
              value={hgvsp}
              onChange={(e) => setHgvsp(e.target.value)}
              placeholder="e.g. p.Gln1756fs"
              className="w-[160px]"
            />
          </div>
          <LabeledCheckbox isSelected={forceRefresh} onChange={setForceRefresh}>
            Force refresh
          </LabeledCheckbox>
          <Button size="sm" variant="primary" type="submit" isDisabled={searching}>
            {searching ? 'Searching…' : 'Search & Cache'}
          </Button>
          {searchMsg && <span className="text-sm text-muted">{searchMsg}</span>}
        </form>
        {searchResult.length > 0 && (
          <div className="mt-3">
            <ArticleTable
              articles={searchResult}
              onDelete={handleDelete}
              onDetail={openDetail}
              compact
            />
          </div>
        )}
      </details>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : articles.length === 0 && !dbMissing ? (
        <p className="text-muted">No articles in cache.</p>
      ) : (
        <ArticleTable articles={articles} onDelete={handleDelete} onDetail={openDetail} />
      )}

      {total > PER_PAGE && (
        <div className="flex flex-wrap gap-2 items-center mt-3">
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page <= 1}
            onPress={() => {
              const n = page - 1;
              setPage(n);
              void load(n, q, sort);
            }}
          >
            ‹ Prev
          </Button>
          <span className="text-sm text-muted">
            Page {page} / {totalPages} · {total} articles
          </span>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page >= totalPages}
            onPress={() => {
              const n = page + 1;
              setPage(n);
              void load(n, q, sort);
            }}
          >
            Next ›
          </Button>
        </div>
      )}

      <Modal isOpen={detail != null} onOpenChange={(open) => !open && setDetail(null)}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Article Detail</Modal.Heading>
                <Modal.CloseTrigger />
              </Modal.Header>
              <Modal.Body className="max-h-[60vh] overflow-y-auto text-sm leading-relaxed">
                {detail && (
                  <>
                    {detailLoading && (
                      <p className="text-xs text-muted mb-2">Loading full article…</p>
                    )}
                    <p>
                      <strong>PMID:</strong>{' '}
                      <Link
                        href={`https://pubmed.ncbi.nlm.nih.gov/${detail.pmid}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {detail.pmid} ↗
                      </Link>
                    </p>
                    {detail.doi ? (
                      <p>
                        <strong>DOI:</strong>{' '}
                        <Link
                          href={`https://doi.org/${String(detail.doi)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {String(detail.doi)} ↗
                        </Link>
                      </p>
                    ) : null}
                    {detail.title && (
                      <p>
                        <strong>Title:</strong> {detail.title}
                      </p>
                    )}
                    {detail.journal && (
                      <p>
                        <strong>Journal:</strong> {detail.journal}
                      </p>
                    )}
                    {detail.pub_date && (
                      <p>
                        <strong>Published:</strong> {detail.pub_date}
                      </p>
                    )}
                    {detail.authors && (
                      <p>
                        <strong>Authors:</strong>{' '}
                        {Array.isArray(detail.authors)
                          ? detail.authors.join(', ')
                          : String(detail.authors)}
                      </p>
                    )}
                    {detail.abstract && (
                      <p>
                        <strong>Abstract:</strong> {detail.abstract}
                      </p>
                    )}
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="primary"
                        onPress={() =>
                          window.open(
                            `https://pubmed.ncbi.nlm.nih.gov/${detail.pmid}`,
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                      >
                        Open in PubMed
                      </Button>
                    </div>
                  </>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

function ArticleTable({
  articles,
  onDelete,
  onDetail,
  compact,
}: {
  articles: LiteratureArticle[];
  onDelete: (pmid: string) => void;
  onDetail: (a: LiteratureArticle) => void;
  compact?: boolean;
}) {
  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Literature articles">
          <Table.Header>
            <Table.Column isRowHeader>PMID</Table.Column>
            <Table.Column>Title</Table.Column>
            {!compact && (
              <>
                <Table.Column>Journal</Table.Column>
                <Table.Column>Pub Date</Table.Column>
                <Table.Column>Cached</Table.Column>
              </>
            )}
            <Table.Column>Actions</Table.Column>
          </Table.Header>
          <Table.Body>
            {articles.map((a) => (
              <Table.Row key={a.pmid}>
                <Table.Cell>
                  <Link
                    href={`https://pubmed.ncbi.nlm.nih.gov/${a.pmid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs whitespace-nowrap"
                  >
                    {a.pmid}
                  </Link>
                </Table.Cell>
                <Table.Cell>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-auto min-h-0 p-0 text-left font-normal"
                    onPress={() => onDetail(a)}
                  >
                    {a.title ?? '—'}
                  </Button>
                </Table.Cell>
                {!compact && (
                  <>
                    <Table.Cell>
                      <span className="text-sm text-muted whitespace-nowrap">
                        {a.journal ?? '—'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted whitespace-nowrap">
                        {a.pub_date ?? '—'}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted whitespace-nowrap">
                        {a.cached_at ? formatPortalDate(String(a.cached_at)) : '—'}
                      </span>
                    </Table.Cell>
                  </>
                )}
                <Table.Cell>
                  <Button
                    size="sm"
                    variant="danger"
                    isIconOnly
                    aria-label={`Delete PMID ${a.pmid}`}
                    onPress={() => onDelete(a.pmid)}
                  >
                    <Trash2 size={15} strokeWidth={2} aria-hidden />
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
