'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { systemApi } from '../../lib/api/system';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import styles from './Config.module.css';

// ─── constants ────────────────────────────────────────────────────────────────

const PIPELINE_CFG_KEY = 'gx-portal-pipeline-config';
const AI_PROVIDER_KEY  = 'gx-portal-ai-provider';
const DAEMON_URL_KEY   = 'gx-portal-daemon-url';

const DAEMON_PRESETS = [
  { id: 'prod', label: 'gx-daemon (prod)', port: 8010 },
  { id: 'dev',  label: 'gx-daemon (dev)',  port: 8011 },
];

function presetUrl(port: number) {
  if (typeof window === 'undefined') return `http://localhost:${port}`;
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

/** Daemon returns { lines: string[] } — join them into plain text */
function extractLines(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'lines' in raw) {
    const lines = (raw as { lines: unknown }).lines;
    if (Array.isArray(lines)) return lines.join('\n');
  }
  if (typeof raw === 'string') return raw;
  return JSON.stringify(raw, null, 2);
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children, description }: { title: string; children: React.ReactNode; description?: string }) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {description && <p className={styles.sectionDesc}>{description}</p>}
      {children}
    </div>
  );
}

// ─── Daemon Connection ────────────────────────────────────────────────────────

function DaemonConnectionSection() {
  const [daemonUrl, setDaemonUrl] = useState('');
  const [apiKey, setApiKey]       = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting]     = useState(false);
  const [connResult, setConnResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Log state
  const [log, setLog]             = useState('');
  const [logLines, setLogLines]   = useState(200);
  const [paused, setPaused]       = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logStatus, setLogStatus] = useState('');
  const logBoxRef = useRef<HTMLPreElement>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Init
  useEffect(() => {
    const saved = localStorage.getItem(DAEMON_URL_KEY);
    systemApi.getConfig().then((cfg) => {
      const url = saved ?? cfg.daemonUrl ?? '';
      setDaemonUrl(url);
      const matched = DAEMON_PRESETS.find((p) => url.includes(`:${p.port}`));
      if (matched) setActivePreset(matched.id);
    }).catch(() => {
      if (saved) setDaemonUrl(saved);
    });
  }, []);

  // Log polling
  const fetchLog = useCallback(async () => {
    try {
      setLogStatus('Fetching…');
      const raw = await systemApi.log(logLines);
      // Daemon returns { lines: string[] } — extract just the log lines
      let text: string;
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw) as unknown;
          text = extractLines(parsed);
        } catch {
          text = raw;
        }
      } else {
        text = extractLines(raw);
      }
      setLog(text);
      setLogStatus(new Date().toLocaleTimeString());
      if (autoScroll && logBoxRef.current) {
        logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
      }
    } catch {
      setLogStatus('Error fetching log');
    }
  }, [logLines, autoScroll]);

  useEffect(() => {
    fetchLog();
    timerRef.current = setInterval(() => {
      if (!paused) fetchLog();
    }, 3000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchLog, paused]);

  const applyPreset = (preset: typeof DAEMON_PRESETS[0]) => {
    const url = presetUrl(preset.port);
    setDaemonUrl(url);
    setActivePreset(preset.id);
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnResult(null);
    try {
      await systemApi.setConfig(daemonUrl, apiKey || undefined);
      localStorage.setItem(DAEMON_URL_KEY, daemonUrl);
      const health = await systemApi.health().catch(() => null);
      const daemon = (health as { daemon?: { status?: string } })?.daemon;
      if (daemon?.status === 'ok') {
        setConnResult({ ok: true, msg: `Connected · ${daemon.status}` });
      } else {
        setConnResult({ ok: false, msg: `Daemon status: ${daemon?.status ?? 'unknown'}` });
      }
    } catch (e) {
      setConnResult({ ok: false, msg: e instanceof Error ? e.message : 'Connection failed' });
    } finally {
      setConnecting(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setConnResult(null);
    try {
      const health = await systemApi.health();
      const daemon = (health as { daemon?: { status?: string; service?: string; environment?: string } })?.daemon;
      setConnResult({ ok: daemon?.status === 'ok', msg: `${daemon?.service ?? 'daemon'} · ${daemon?.status ?? '?'} · ${daemon?.environment ?? ''}` });
    } catch (e) {
      setConnResult({ ok: false, msg: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Section
      title="Daemon Connection"
      description="Select which gx-daemon this Portal connects to. All API calls (Submit, Review, Report…) are routed to the active daemon."
    >
      {/* Preset buttons */}
      <div className={styles.presetRow}>
        {DAEMON_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.presetBtn} ${activePreset === p.id ? styles.presetActive : ''}`}
            onClick={() => applyPreset(p)}
          >
            {p.label} <span className={styles.muted}>:{p.port}</span>
          </button>
        ))}
      </div>

      {/* URL + API Key */}
      <div className={styles.row}>
        <div className={styles.fieldGrow}>
          <label className={styles.label}>Daemon URL</label>
          <input
            type="text"
            value={daemonUrl}
            onChange={(e) => { setDaemonUrl(e.target.value); setActivePreset(null); }}
            placeholder="http://host:port"
            className={styles.input}
          />
        </div>
        <div className={styles.fieldFixed}>
          <label className={styles.label}>X-API-Key <span className={styles.muted}>(optional)</span></label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="leave empty if not set"
            className={styles.input}
          />
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actionRow}>
        <Button size="sm" variant="primary" loading={connecting} onClick={handleConnect}>Connect</Button>
        <Button size="sm" variant="secondary" loading={testing} onClick={handleTest}>Test</Button>
        {connResult && (
          <span className={connResult.ok ? styles.ok : styles.err}>{connResult.msg}</span>
        )}
      </div>

      {/* ── Daemon Log ── */}
      <div className={styles.logHeader}>
        <span className={styles.logTitle}>Daemon Log</span>
        <Button size="sm" variant="ghost" onClick={() => setPaused((p) => !p)}>
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setLog('')}>Clear</Button>
        <Button size="sm" variant="ghost" onClick={fetchLog}>Refresh</Button>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
        <label className={styles.checkLabel}>
          Fetch last
          <select
            value={logLines}
            onChange={(e) => setLogLines(parseInt(e.target.value, 10))}
            className={styles.selectSm}
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
          </select>
          from daemon
        </label>
        <span className={styles.logStatus}>{paused ? '⏸ paused' : logStatus}</span>
      </div>
      <pre ref={logBoxRef} className={styles.logBox}>{log || '(waiting for log…)'}</pre>
    </Section>
  );
}

// ─── AI Provider ──────────────────────────────────────────────────────────────

function AiProviderSection() {
  const [provider, setProvider]     = useState<'gemini' | 'ollama'>('gemini');
  const [ollamaUrl, setOllamaUrl]   = useState('http://host.docker.internal:11434/v1');
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [geminiKeyStatus, setGeminiKeyStatus] = useState('—');
  const [saving, setSaving]         = useState(false);
  const [saveResult, setSaveResult] = useState('');

  const refreshModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      // Use the daemon's /ai/ollama/models endpoint via BFF
      const res = await systemApi.getOllamaModels();
      // Daemon may return { models: [{name}...] } or a plain array or { models: string[] }
      let names: string[] = [];
      if (Array.isArray(res)) {
        names = res.map((m) => (typeof m === 'string' ? m : (m as { name?: string }).name ?? ''));
      } else if (res && typeof res === 'object' && 'models' in res) {
        const models = (res as { models?: unknown[] }).models ?? [];
        names = models.map((m) => (typeof m === 'string' ? m : (m as { name?: string }).name ?? ''));
      }
      setOllamaModels(names.filter(Boolean));
    } catch { setOllamaModels([]); }
    finally { setModelsLoading(false); }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(AI_PROVIDER_KEY);
    let initialProvider: 'gemini' | 'ollama' = 'gemini';
    if (saved) {
      try {
        const cfg = JSON.parse(saved) as { provider?: string; ollamaUrl?: string; ollamaModel?: string };
        if (cfg.provider === 'gemini' || cfg.provider === 'ollama') { setProvider(cfg.provider); initialProvider = cfg.provider; }
        if (cfg.ollamaUrl)   setOllamaUrl(cfg.ollamaUrl);
        if (cfg.ollamaModel) setOllamaModel(cfg.ollamaModel);
      } catch { /* ignore */ }
    }
    systemApi.getAiConfig().then((cfg) => {
      const c = cfg as { provider?: string; gemini?: { key_loaded?: boolean }; ollama?: { base_url?: string; model?: string } };
      if (c?.provider === 'gemini' || c?.provider === 'ollama') { setProvider(c.provider); initialProvider = c.provider; }
      if (c?.gemini?.key_loaded) setGeminiKeyStatus('✓ loaded from daemon .env');
      else if (c?.gemini?.key_loaded === false) setGeminiKeyStatus('✗ not set');
      if (c?.ollama?.base_url)  setOllamaUrl(c.ollama.base_url);
      if (c?.ollama?.model)     setOllamaModel(c.ollama.model);
      // Auto-load models if Ollama is active
      if (initialProvider === 'ollama') refreshModels();
    }).catch(() => {
      if (initialProvider === 'ollama') refreshModels();
    });
  }, [refreshModels]);

  const handleApply = async () => {
    setSaving(true);
    setSaveResult('');
    const cfg = { provider, ollama: { base_url: ollamaUrl, model: ollamaModel } };
    localStorage.setItem(AI_PROVIDER_KEY, JSON.stringify({ provider, ollamaUrl, ollamaModel }));
    try {
      await systemApi.setAiConfig(cfg);
      setSaveResult('Saved');
    } catch { setSaveResult('Saved locally (daemon unreachable)'); }
    finally { setSaving(false); }
  };

  return (
    <Section
      title="AI Provider"
      description="Select the AI provider for Gene Knowledge (new write-up). Gemini requires a Google API key. Ollama uses a local LLM model."
    >
      <div className={styles.radioRow}>
        {(['gemini', 'ollama'] as const).map((p) => (
          <label key={p} className={styles.radioLabel}>
            <input type="radio" name="aiProvider" value={p} checked={provider === p} onChange={() => {
              setProvider(p);
              if (p === 'ollama') refreshModels();
            }} />
            <strong>{p.charAt(0).toUpperCase() + p.slice(1)}</strong>
          </label>
        ))}
      </div>

      {provider === 'gemini' && (
        <div className={styles.infoBox}>
          <p>Key status: <span className={geminiKeyStatus.startsWith('✓') ? styles.ok : styles.muted}>{geminiKeyStatus}</span></p>
          <p className={styles.hint}>Gemini API key is loaded from <code>GEMINI_API_KEY</code> in the gx-daemon <code>.env</code>.</p>
        </div>
      )}

      {provider === 'ollama' && (
        <>
          <div className={styles.row}>
            <div className={styles.fieldGrow}>
              <label className={styles.label}>Ollama Base URL</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://host.docker.internal:11434/v1"
                className={styles.input}
              />
            </div>
            <div className={styles.fieldFixed}>
              <label className={styles.label}>Model</label>
              <select value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} className={styles.input}>
                <option value="">{modelsLoading ? '— loading… —' : ollamaModels.length === 0 ? '— no models found —' : '— select model —'}</option>
                {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 6 }}>
              <Button size="sm" variant="secondary" loading={modelsLoading} onClick={refreshModels}>⟳ Refresh models</Button>
            </div>
          </div>
        </>
      )}

      <div className={styles.actionRow}>
        <Button size="sm" variant="primary" loading={saving} onClick={handleApply}>
          {provider === 'ollama' ? 'Apply Ollama Settings' : 'Apply'}
        </Button>
        {saveResult && <span className={styles.ok}>{saveResult}</span>}
      </div>
    </Section>
  );
}

// ─── Pipeline Options ─────────────────────────────────────────────────────────

function PipelineOptionsSection() {
  const [useSsd, setUseSsd]           = useState(false);
  const [scratchDir, setScratchDir]   = useState('');
  const [saving, setSaving]           = useState(false);
  const [saveResult, setSaveResult]   = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(PIPELINE_CFG_KEY);
    if (saved) {
      try {
        const cfg = JSON.parse(saved) as { useSsd?: boolean; scratchDir?: string };
        setUseSsd(cfg.useSsd ?? false);
        setScratchDir(cfg.scratchDir ?? '');
      } catch { /* ignore */ }
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem(PIPELINE_CFG_KEY, JSON.stringify({ useSsd, scratchDir }));
    setTimeout(() => { setSaving(false); setSaveResult('Saved'); setTimeout(() => setSaveResult(''), 2500); }, 200);
  };

  const exampleCmd = useSsd && scratchDir
    ? `./src/run_analysis.sh -w 2604 -s Sample_A10 --use-ssd --scratch-dir ${scratchDir}`
    : `./src/run_analysis.sh -w 2604 -s Sample_A10`;

  return (
    <Section
      title="Pipeline Options"
      description="Applied when you Submit, Force Run, or Force Run (Fresh) for Carrier screening / Whole exome / Health screening."
    >
      <div className={styles.checkRow}>
        <input
          type="checkbox"
          id="cfgUseSsd"
          checked={useSsd}
          onChange={(e) => setUseSsd(e.target.checked)}
          className={styles.checkbox}
        />
        <label htmlFor="cfgUseSsd" style={{ cursor: 'pointer', fontSize: 14 }}>
          <strong>Use SSD</strong> — adds <code>--use-ssd --scratch-dir &lt;path&gt;</code> to the pipeline command
        </label>
      </div>

      {useSsd && (
        <div style={{ marginTop: 12 }}>
          <label className={styles.label} htmlFor="cfgScratch">Scratch location (host path)</label>
          <input
            id="cfgScratch"
            type="text"
            value={scratchDir}
            onChange={(e) => setScratchDir(e.target.value)}
            placeholder="/tmp/exome-scratch"
            className={styles.input}
            style={{ maxWidth: 480 }}
          />
        </div>
      )}

      <p className={styles.hint}>Example: <code>{exampleCmd}</code></p>

      <div className={styles.actionRow}>
        <Button size="sm" variant="primary" loading={saving} onClick={handleSave}>Save</Button>
        {saveResult && <span className={styles.ok}>{saveResult}</span>}
      </div>
    </Section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ConfigPageClient() {
  return (
    <div>
      <PageHeader title="Configuration" description="Portal and gx-daemon connection, AI provider, and pipeline options." />
      <div className={styles.pageBody}>
        <DaemonConnectionSection />
        <AiProviderSection />
        <PipelineOptionsSection />
      </div>
    </div>
  );
}
