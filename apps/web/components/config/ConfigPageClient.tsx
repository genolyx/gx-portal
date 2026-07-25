'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Button,
  ButtonGroup,
  Card,
  Input,
  Label,
  ListBox,
  Radio,
  RadioGroup,
  Select,
  Switch,
} from '@heroui/react';
import { Pause, Play, Trash2 } from 'lucide-react';
import { systemApi } from '../../lib/api/system';
import { DAEMON_PRESETS, DAEMON_URL_KEY } from '../../lib/daemon-presets';
import { formatPortalTimeNow } from '../../lib/datetime';
import { LabeledCheckbox } from '../ui/LabeledCheckbox';
import { PageHeader } from '../ui/PageHeader';
import { RefreshButton } from '../ui/RefreshButton';

const PIPELINE_CFG_KEY = 'gx-portal-pipeline-config';
const AI_PROVIDER_KEY = 'gx-portal-ai-provider';

function presetUrl(port: number) {
  if (typeof window === 'undefined') return `http://localhost:${port}`;
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

function extractLines(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'lines' in raw) {
    const lines = (raw as { lines: unknown }).lines;
    if (Array.isArray(lines)) return lines.join('\n');
  }
  if (typeof raw === 'string') return raw;
  return JSON.stringify(raw, null, 2);
}

function Section({
  title,
  children,
  description,
}: {
  title: string;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        {description && <Card.Description>{description}</Card.Description>}
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">{children}</Card.Content>
    </Card>
  );
}

function DaemonConnectionSection() {
  const [logLoading, setLogLoading] = useState(false);
  const [daemonUrl, setDaemonUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connResult, setConnResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const [log, setLog] = useState('');
  const [logLines, setLogLines] = useState(200);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logStatus, setLogStatus] = useState('');
  const logBoxRef = useRef<HTMLPreElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const saved = localStorage.getItem(DAEMON_URL_KEY);
    systemApi
      .getConfig()
      .then((cfg) => {
        const url = saved ?? cfg.daemonUrl ?? '';
        setDaemonUrl(url);
        const matched = DAEMON_PRESETS.find((p) => url.includes(`:${p.port}`));
        if (matched) setActivePreset(matched.id);
      })
      .catch(() => {
        if (saved) setDaemonUrl(saved);
      });
  }, []);

  const fetchLog = useCallback(async (manual = false) => {
    if (manual) setLogLoading(true);
    try {
      setLogStatus('Fetching…');
      const raw = await systemApi.log(logLines);
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
      setLogStatus(formatPortalTimeNow());
      if (autoScroll && logBoxRef.current) {
        logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
      }
    } catch (e) {
      setLogStatus('Error fetching log');
      if (manual) throw e instanceof Error ? e : new Error('Failed to refresh log');
    } finally {
      if (manual) setLogLoading(false);
    }
  }, [logLines, autoScroll]);

  useEffect(() => {
    void fetchLog(false);
    timerRef.current = setInterval(() => {
      if (!paused) void fetchLog(false);
    }, 3000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchLog, paused]);

  const applyPreset = (preset: (typeof DAEMON_PRESETS)[number]) => {
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
      const daemon = (health as {
        daemon?: { status?: string; service?: string; environment?: string };
      })?.daemon;
      setConnResult({
        ok: daemon?.status === 'ok',
        msg: `${daemon?.service ?? 'daemon'} · ${daemon?.status ?? '?'} · ${daemon?.environment ?? ''}`,
      });
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
      <ButtonGroup>
        {DAEMON_PRESETS.map((p) => {
          const active = activePreset === p.id;
          return (
            <Button
              key={p.id}
              size="sm"
              variant={active ? 'primary' : 'secondary'}
              onPress={() => applyPreset(p)}
            >
              {p.label}{' '}
              <span className={active ? 'opacity-90' : 'opacity-60'}>
                :{p.port}
              </span>
            </Button>
          );
        })}
      </ButtonGroup>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-1 min-w-[240px] flex-col gap-1.5">
          <Label>Daemon URL</Label>
          <Input
            type="text"
            value={daemonUrl}
            onChange={(e) => {
              setDaemonUrl(e.target.value);
              setActivePreset(null);
            }}
            placeholder="http://host:port"
            fullWidth
          />
        </div>
        <div className="flex w-full sm:w-64 flex-col gap-1.5">
          <Label>
            X-API-Key <span className="text-muted">(optional)</span>
          </Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="leave empty if not set"
            fullWidth
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="primary" isDisabled={connecting} onPress={handleConnect}>
          {connecting ? 'Connecting…' : 'Connect'}
        </Button>
        <Button size="sm" variant="secondary" isDisabled={testing} onPress={handleTest}>
          {testing ? 'Testing…' : 'Test'}
        </Button>
        {connResult && (
          <span className={connResult.ok ? 'text-sm text-success' : 'text-sm text-danger'}>
            {connResult.msg}
          </span>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
          <span className="text-sm font-semibold text-foreground">Daemon Log</span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <LabeledCheckbox
              isSelected={autoScroll}
              onChange={setAutoScroll}
              contentClassName="text-sm"
            >
              Auto-scroll
            </LabeledCheckbox>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>Fetch last</span>
              <Select
                selectedKey={String(logLines)}
                onSelectionChange={(key) => setLogLines(parseInt(String(key), 10))}
                aria-label="Fetch last N lines"
              >
                <Select.Trigger className="min-w-[120px]">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="50" textValue="50 lines">
                      50 lines
                    </ListBox.Item>
                    <ListBox.Item id="100" textValue="100 lines">
                      100 lines
                    </ListBox.Item>
                    <ListBox.Item id="200" textValue="200 lines">
                      200 lines
                    </ListBox.Item>
                    <ListBox.Item id="500" textValue="500 lines">
                      500 lines
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setPaused((p) => !p)}
              className="gap-1.5"
            >
              {paused ? (
                <Play size={14} strokeWidth={2} aria-hidden />
              ) : (
                <Pause size={14} strokeWidth={2} aria-hidden />
              )}
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setLog('')}
              className="gap-1.5"
            >
              <Trash2 size={14} strokeWidth={2} aria-hidden />
              Clear
            </Button>
            <RefreshButton
              variant="ghost"
              label="Refresh"
              successToast="Log refreshed"
              isLoading={logLoading}
              onPress={() => fetchLog(true)}
            />
            <span className="text-xs text-muted">
              {paused ? 'paused' : logStatus}
            </span>
          </div>
        </div>
        <pre
          ref={logBoxRef}
          className="bg-surface-secondary border border-border rounded-lg p-3 text-xs font-mono overflow-auto max-h-80 whitespace-pre-wrap"
        >
          {log || '(waiting for log…)'}
        </pre>
      </div>
    </Section>
  );
}

function AiProviderSection() {
  const [provider, setProvider] = useState<'gemini' | 'ollama'>('gemini');
  const [ollamaUrl, setOllamaUrl] = useState('http://host.docker.internal:11434/v1');
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [geminiKeyStatus, setGeminiKeyStatus] = useState('—');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState('');
  const [pullName, setPullName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState('');
  const [pullPct, setPullPct] = useState<number | null>(null);

  const refreshModels = useCallback(async (manual = false) => {
    setModelsLoading(true);
    try {
      const res = await systemApi.getOllamaModels();
      let names: string[] = [];
      if (Array.isArray(res)) {
        names = res.map((m) => (typeof m === 'string' ? m : (m as { name?: string }).name ?? ''));
      } else if (res && typeof res === 'object' && 'models' in res) {
        const models = (res as { models?: unknown[] }).models ?? [];
        names = models.map((m) => (typeof m === 'string' ? m : (m as { name?: string }).name ?? ''));
      }
      setOllamaModels(names.filter(Boolean));
    } catch (e) {
      setOllamaModels([]);
      if (manual) throw e instanceof Error ? e : new Error('Failed to refresh models');
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(AI_PROVIDER_KEY);
    let initialProvider: 'gemini' | 'ollama' = 'gemini';
    if (saved) {
      try {
        const cfg = JSON.parse(saved) as {
          provider?: string;
          ollamaUrl?: string;
          ollamaModel?: string;
        };
        if (cfg.provider === 'gemini' || cfg.provider === 'ollama') {
          setProvider(cfg.provider);
          initialProvider = cfg.provider;
        }
        if (cfg.ollamaUrl) setOllamaUrl(cfg.ollamaUrl);
        if (cfg.ollamaModel) setOllamaModel(cfg.ollamaModel);
      } catch {
        /* ignore */
      }
    }
    systemApi
      .getAiConfig()
      .then((cfg) => {
        const c = cfg as {
          provider?: string;
          gemini?: { available?: boolean; key_loaded?: boolean };
          ollama?: { base_url?: string; model?: string };
        };
        if (c?.provider === 'gemini' || c?.provider === 'ollama') {
          setProvider(c.provider);
          initialProvider = c.provider;
        }
        const available = c?.gemini?.available ?? c?.gemini?.key_loaded;
        if (available === true) setGeminiKeyStatus('✓ loaded from daemon .env');
        else if (available === false) setGeminiKeyStatus('✗ not set');
        if (c?.ollama?.base_url) setOllamaUrl(c.ollama.base_url);
        if (c?.ollama?.model) setOllamaModel(c.ollama.model);
        if (initialProvider === 'ollama') refreshModels();
      })
      .catch(() => {
        if (initialProvider === 'ollama') refreshModels();
      });
  }, [refreshModels]);

  const handleApply = async () => {
    setSaving(true);
    setSaveResult('');
    // Daemon expects flat keys: provider, ollama_base_url, ollama_model
    const cfg = {
      provider,
      ollama_base_url: ollamaUrl,
      ollama_model: ollamaModel,
    };
    localStorage.setItem(AI_PROVIDER_KEY, JSON.stringify({ provider, ollamaUrl, ollamaModel }));
    try {
      await systemApi.setAiConfig(cfg);
      setSaveResult('Saved');
    } catch {
      setSaveResult('Saved locally (daemon unreachable)');
    } finally {
      setSaving(false);
    }
  };

  const handlePull = async () => {
    const model = pullName.trim();
    if (!model) {
      setPullStatus('Enter a model name (e.g. qwen2.5:14b)');
      return;
    }
    setPulling(true);
    setPullStatus('Starting pull…');
    setPullPct(null);
    try {
      await systemApi.pullOllamaModel(model, (evt) => {
        if (evt.error) {
          setPullStatus(String(evt.error));
          return;
        }
        const status = String(evt.status ?? '');
        const completed = Number(evt.completed ?? 0);
        const total = Number(evt.total ?? 0);
        if (total > 0) {
          const pct = Math.min(100, Math.round((completed / total) * 100));
          setPullPct(pct);
          setPullStatus(status || `Downloading… ${pct}%`);
        } else {
          setPullStatus(status || 'Working…');
        }
        if (status === 'success') {
          setPullPct(100);
          setPullStatus('Pull complete');
        }
      });
      await refreshModels();
      if (model) setOllamaModel(model);
    } catch (e) {
      setPullStatus(e instanceof Error ? e.message : 'Pull failed');
    } finally {
      setPulling(false);
    }
  };

  return (
    <Section
      title="AI Provider"
      description="Select the AI provider for Gene Knowledge (new write-up). Gemini requires a Google API key. Ollama uses a local LLM model."
    >
      <RadioGroup
        value={provider}
        onChange={(v) => {
          const next = v as 'gemini' | 'ollama';
          setProvider(next);
          if (next === 'ollama') refreshModels();
        }}
        orientation="horizontal"
        className="flex-row flex-wrap items-center gap-4"
      >
        {(['gemini', 'ollama'] as const).map((p) => (
          <Radio key={p} value={p}>
            <Radio.Content className="font-semibold capitalize">
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              {p}
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>

      {provider === 'gemini' && (
        <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm">
          <p>
            Key status:{' '}
            <span className={geminiKeyStatus.startsWith('✓') ? 'text-success' : 'text-muted'}>
              {geminiKeyStatus}
            </span>
          </p>
          <p className="mt-2 text-xs text-muted">
            Gemini API key is loaded from <code>GEMINI_API_KEY</code> in the gx-daemon{' '}
            <code>.env</code>.
          </p>
        </div>
      )}

      {provider === 'ollama' && (
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-1 min-w-[240px] flex-col gap-1.5">
            <Label>Ollama Base URL</Label>
            <Input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://host.docker.internal:11434/v1"
              fullWidth
            />
          </div>
          <div className="flex w-full sm:w-64 flex-col gap-1.5">
            <Label>Model</Label>
            <Select
              selectedKey={ollamaModel || null}
              onSelectionChange={(key) => setOllamaModel(String(key ?? ''))}
              fullWidth
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {ollamaModels.length === 0 ? (
                    <ListBox.Item
                      id=""
                      textValue={modelsLoading ? 'loading' : 'no models'}
                      isDisabled
                    >
                      {modelsLoading ? '— loading… —' : '— no models found —'}
                    </ListBox.Item>
                  ) : (
                    ollamaModels.map((m) => (
                      <ListBox.Item key={m} id={m} textValue={m}>
                        {m}
                      </ListBox.Item>
                    ))
                  )}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <RefreshButton
            label="Refresh models"
            loadingLabel="Loading models…"
            successToast="Models refreshed"
            isLoading={modelsLoading}
            onPress={() => refreshModels(true)}
          />
        </div>
      )}

      {provider === 'ollama' && (
        <div className="rounded-lg border border-border bg-surface-secondary p-4">
          <p className="mb-2 text-sm font-medium">Pull Ollama model</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-1 min-w-[200px] flex-col gap-1.5">
              <Label>Model name</Label>
              <Input
                value={pullName}
                onChange={(e) => setPullName(e.target.value)}
                placeholder="e.g. qwen2.5:14b"
                fullWidth
              />
            </div>
            <Button size="sm" variant="secondary" isDisabled={pulling} onPress={() => void handlePull()}>
              {pulling ? 'Pulling…' : 'Pull model'}
            </Button>
          </div>
          {(pullStatus || pullPct != null) && (
            <div className="mt-2 text-xs text-muted">
              {pullStatus}
              {pullPct != null ? ` (${pullPct}%)` : ''}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="primary" isDisabled={saving} onPress={handleApply}>
          {saving
            ? 'Saving…'
            : provider === 'ollama'
              ? 'Apply Ollama Settings'
              : 'Apply'}
        </Button>
        {saveResult && <span className="text-sm text-success">{saveResult}</span>}
      </div>
    </Section>
  );
}

function PipelineOptionsSection() {
  const [useSsd, setUseSsd] = useState(false);
  const [scratchDir, setScratchDir] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(PIPELINE_CFG_KEY);
    if (saved) {
      try {
        const cfg = JSON.parse(saved) as { useSsd?: boolean; scratchDir?: string };
        setUseSsd(cfg.useSsd ?? false);
        setScratchDir(cfg.scratchDir ?? '');
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem(PIPELINE_CFG_KEY, JSON.stringify({ useSsd, scratchDir }));
    setTimeout(() => {
      setSaving(false);
      setSaveResult('Saved');
      setTimeout(() => setSaveResult(''), 2500);
    }, 200);
  };

  const exampleCmd =
    useSsd && scratchDir
      ? `./src/run_analysis.sh -w 2604 -s Sample_A10 --use-ssd --scratch-dir ${scratchDir}`
      : `./src/run_analysis.sh -w 2604 -s Sample_A10`;

  return (
    <Section
      title="Pipeline Options"
      description="Applied when you Submit, Force Run, or Force Run (Fresh) for Carrier screening / Whole exome / Health screening."
    >
      <Switch isSelected={useSsd} onChange={setUseSsd}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <span className="text-sm">
            <strong>Use SSD</strong> — adds <code>--use-ssd --scratch-dir &lt;path&gt;</code> to the
            pipeline command
          </span>
        </Switch.Content>
      </Switch>

      {useSsd && (
        <div className="flex flex-col gap-1.5 max-w-lg">
          <Label htmlFor="cfgScratch">Scratch location (host path)</Label>
          <Input
            id="cfgScratch"
            type="text"
            value={scratchDir}
            onChange={(e) => setScratchDir(e.target.value)}
            placeholder="/tmp/exome-scratch"
            fullWidth
          />
        </div>
      )}

      <p className="text-xs text-muted">
        Example: <code>{exampleCmd}</code>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="primary" isDisabled={saving} onPress={handleSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {saveResult && <span className="text-sm text-success">{saveResult}</span>}
      </div>
    </Section>
  );
}

export function ConfigPageClient() {
  return (
    <div>
      <PageHeader
        title="Configuration"
        description="Portal and gx-daemon connection, AI provider, and pipeline options."
      />
      <div className="flex flex-col gap-6">
        <DaemonConnectionSection />
        <AiProviderSection />
        <PipelineOptionsSection />
      </div>
    </div>
  );
}
