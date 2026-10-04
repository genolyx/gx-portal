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
import { Pause, Play, Trash2, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { systemApi, type InterpretationSettings, type ServiceParityReport } from '../../lib/api/system';
import { authApi } from '../../lib/api/auth';
import type { UserProfile } from '@gx-portal/types';
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

const CLASSIFICATION_SERVICES = [
  { id: 'carrier_screening' as const, label: 'Carrier screening' },
  { id: 'whole_exome' as const, label: 'Whole exome' },
  { id: 'hereditary_cancer' as const, label: 'Hereditary cancer' },
  { id: 'health_screening' as const, label: 'Health screening' },
];

function ClassificationSourceSection() {
  const [source, setSource] = useState<'pipeline' | 'gvc'>('pipeline');
  const [services, setServices] = useState<InterpretationSettings['services']>({});
  const [orderDrafts, setOrderDrafts] = useState<Record<string, string>>({});
  const [reports, setReports] = useState<Record<string, ServiceParityReport>>({});
  const [gvcConfigured, setGvcConfigured] = useState(false);
  const [url, setUrl] = useState('');
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [tokenDraft, setTokenDraft] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [showFresh, setShowFresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink] = useState<{ ok: boolean; message: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const checkLink = useCallback(() => {
    setChecking(true);
    systemApi
      .checkInterpretation()
      .then(setLink)
      .catch(() => setLink({ ok: false, message: 'Could not check the GVC connection.' }))
      .finally(() => setChecking(false));
  }, []);

  const apply = (cfg: InterpretationSettings) => {
    setSource(cfg.source);
    setGvcConfigured(cfg.gvcConfigured);
    setUrl(cfg.url);
    setTokenPreview(cfg.tokenPreview);
    setServices(cfg.services ?? {});
  };

  useEffect(() => {
    systemApi
      .getInterpretation()
      .then(apply)
      .catch(() => setMsg({ ok: false, text: 'Could not load the classification setting.' }));
    checkLink();
  }, [checkLink]);

  const save = async (next: 'pipeline' | 'gvc') => {
    setSource(next);
    setSaving(true);
    setMsg(null);
    try {
      const cfg = await systemApi.setInterpretation(next);
      apply(cfg);
      setMsg({
        ok: true,
        text: cfg.source === 'gvc'
          ? cfg.gvcConfigured
            ? 'Reviews now request classifications from GVC. A failed request still shows the portal result.'
            : 'GVC is selected. Save the URL and token below. Until then, reviews keep the portal result.'
          : 'Reviews use the portal classification again. Per-service GVC choices were cleared.',
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const saveUrl = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const cfg = await systemApi.setInterpretationConnection({ url });
      apply(cfg);
      setMsg({ ok: true, text: cfg.url ? 'GVC URL saved.' : 'GVC URL cleared.' });
      checkLink();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const saveToken = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const cfg = await systemApi.setInterpretationConnection({ token: tokenDraft });
      apply(cfg);
      setTokenDraft('');
      setFreshToken(null);
      setMsg({
        ok: true,
        text: tokenDraft.trim()
          ? 'GVC token saved. It must match the token in GVC Settings.'
          : 'Saved GVC token cleared.',
      });
      checkLink();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const generateToken = async () => {
    if (
      tokenPreview &&
      !window.confirm('Generate a new GVC token? The previous token will stop working until GVC uses this one.')
    ) {
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await systemApi.generateInterpretationToken();
      apply(res);
      setFreshToken(res.token);
      setShowFresh(true);
      setTokenDraft('');
      setMsg({
        ok: true,
        text: 'Token generated. Copy it into GVC Settings. GVC uses a saved token immediately.',
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Generate failed' });
    } finally {
      setSaving(false);
    }
  };

  const copyToken = async () => {
    if (!freshToken) return;
    try {
      await navigator.clipboard.writeText(freshToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <Section
      title="Classification"
      description="Portal classification keeps every review on the portal and clears per-service choices. GVC classifies carrier, whole exome, hereditary cancer, and health screening variants. Health screening does not send dark genes. Include PGx and Include APOE PGx are sent with the order, and GVC decides whether those results stay on the PGx tab. A service moves to GVC on its own only after one of its orders matches the portal labels."
    >
      <RadioGroup
        value={source}
        onChange={(value) => { void save(value === 'gvc' ? 'gvc' : 'pipeline'); }}
        isDisabled={saving}
        className="gap-3"
      >
        <Radio value="pipeline">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Portal classification
          </Radio.Content>
        </Radio>
        <Radio value="gvc">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            GVC external API
          </Radio.Content>
        </Radio>
      </RadioGroup>
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        {CLASSIFICATION_SERVICES.map((service) => {
          const chosen = services[service.id];
          const effective = chosen ?? source;
          const report = reports[service.id];
          return (
            <div key={service.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{service.label}</span>
                <span className="text-xs text-muted">
                  {effective === 'gvc' ? 'GVC' : 'Portal'}
                  {chosen ? '' : ' (follows the choice above)'}
                </span>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <Input
                    aria-label={`${service.label} order`}
                    value={orderDrafts[service.id] ?? ''}
                    onChange={(e) => setOrderDrafts((prev) => ({ ...prev, [service.id]: e.target.value }))}
                    placeholder="Order ID to compare"
                    fullWidth
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={saving || !(orderDrafts[service.id] ?? '').trim()}
                  onPress={() => {
                    const orderId = (orderDrafts[service.id] ?? '').trim();
                    setSaving(true);
                    setMsg(null);
                    void systemApi.compareInterpretation(orderId)
                      .then((next) => {
                        setReports((prev) => ({ ...prev, [service.id]: next }));
                        setMsg({ ok: next.agreed, text: next.message });
                      })
                      .catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : 'Compare failed' }))
                      .finally(() => setSaving(false));
                  }}
                >
                  Compare
                </Button>
                {effective === 'gvc' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    isDisabled={saving}
                    onPress={() => {
                      setSaving(true);
                      setMsg(null);
                      void systemApi.setInterpretationService({
                        service: service.id,
                        source: source === 'gvc' ? 'pipeline' : 'default',
                      })
                        .then((cfg) => {
                          apply(cfg);
                          setMsg({ ok: true, text: `${service.label} uses the portal classification.` });
                        })
                        .catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' }))
                        .finally(() => setSaving(false));
                    }}
                  >
                    Use portal
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="primary"
                    isDisabled={saving || !report?.agreed || report.service !== service.id}
                    onPress={() => {
                      const orderId = (orderDrafts[service.id] ?? '').trim();
                      setSaving(true);
                      setMsg(null);
                      void systemApi.setInterpretationService({ service: service.id, source: 'gvc', orderId })
                        .then((cfg) => {
                          apply(cfg);
                          setMsg({ ok: true, text: `${service.label} now uses GVC. Other services stay as they are.` });
                        })
                        .catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' }))
                        .finally(() => setSaving(false));
                    }}
                  >
                    Use GVC
                  </Button>
                )}
              </div>
              {report?.service === service.id && report.examples.length > 0 && (
                <ul className="text-xs text-muted">
                  {report.examples.map((example) => (
                    <li key={example.locus}>
                      {example.locus}: portal {example.pipeline}, GVC {example.gvc}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-5 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-sm font-medium ${link?.ok ? 'text-success' : 'text-danger'}`}>
            {checking ? 'Checking GVC…' : link?.message ?? 'Connection not checked.'}
          </span>
          <Button size="sm" variant="secondary" isDisabled={checking} onPress={checkLink}>
            Check connection
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gvcUrl">GVC URL</Label>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <Input
                id="gvcUrl"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:3010"
                fullWidth
                className="font-mono text-sm"
              />
            </div>
            <Button size="sm" variant="primary" isDisabled={saving} onPress={saveUrl}>
              Save URL
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>GVC API token</Label>
          <p className="text-xs text-muted">
            Generate a token here and paste it into GVC Settings, or paste a token generated on GVC.
            {tokenPreview ? ` Current: ${tokenPreview}` : ' Not configured.'}
            {gvcConfigured ? ' URL and token are ready.' : ' Reviews keep the portal result until both are set.'}
          </p>
          {freshToken && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type={showFresh ? 'text' : 'password'}
                value={freshToken}
                readOnly
                fullWidth
                className="font-mono text-sm"
              />
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setShowFresh((v) => !v)}
                aria-label={showFresh ? 'Hide token' : 'Show token'}
              >
                {showFresh ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="secondary" onPress={copyToken}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? ' Copied' : ' Copy'}
              </Button>
            </div>
          )}
          <div>
            <Button size="sm" variant="primary" isDisabled={saving} onPress={generateToken}>
              {tokenPreview ? 'Generate new token' : 'Generate token'}
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2 pt-2">
            <div className="min-w-[240px] flex-1">
              <Input
                type={showToken ? 'text' : 'password'}
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                placeholder="Paste an existing GVC partner token"
                fullWidth
                className="font-mono text-sm"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => setShowToken((v) => !v)}
              aria-label={showToken ? 'Hide token' : 'Show token'}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="primary" isDisabled={saving} onPress={saveToken}>
              Save token
            </Button>
          </div>
        </div>
      </div>
      {msg && <p className={msg.ok ? 'text-sm text-success' : 'text-sm text-danger'}>{msg.text}</p>}
    </Section>
  );
}

function ExternalPortalKeysSection() {
  const [status, setStatus] = useState<{
    inboundConfigured: boolean;
    outboundConfigured: boolean;
    inboundPreview: string | null;
    outboundPreview: string | null;
  } | null>(null);
  const [outboundDraft, setOutboundDraft] = useState('');
  const [showOutbound, setShowOutbound] = useState(false);
  const [freshInbound, setFreshInbound] = useState<string | null>(null);
  const [showInbound, setShowInbound] = useState(true);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    systemApi
      .getExternalKeys()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generateInbound = async () => {
    if (
      status?.inboundConfigured &&
      !window.confirm('Rotate inbound key? The previous key will stop working immediately.')
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await systemApi.generateInboundKey();
      setFreshInbound(res.key);
      setShowInbound(true);
      setStatus({
        inboundConfigured: res.inboundConfigured,
        outboundConfigured: res.outboundConfigured,
        inboundPreview: res.inboundPreview,
        outboundPreview: res.outboundPreview,
      });
      setMsg({
        ok: true,
        text: 'Inbound key generated. Copy it now and paste into the external portal Outbound API key field.',
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Generate failed' });
    } finally {
      setBusy(false);
    }
  };

  const saveOutbound = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await systemApi.setOutboundKey(outboundDraft);
      setStatus(res);
      setOutboundDraft('');
      setMsg({
        ok: true,
        text: outboundDraft.trim()
          ? 'Outbound key saved (used when gx-portal calls the external portal).'
          : 'Outbound key cleared.',
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setBusy(false);
    }
  };

  const copyInbound = async () => {
    if (!freshInbound) return;
    try {
      await navigator.clipboard.writeText(freshInbound);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <Section
      title="External Portal"
      description="Keys for integrating with an external portal. Inbound = they call gx-portal (their Outbound field). Outbound = we call them back (their Inbound field)."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label>Inbound API key (gx-portal receives)</Label>
          <p className="text-xs text-muted">
            Generate here, then paste into the external portal as <strong>Outbound API key</strong>.
            {status?.inboundConfigured && status.inboundPreview
              ? ` Current: ${status.inboundPreview}`
              : ' Not configured.'}
          </p>
          {freshInbound && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type={showInbound ? 'text' : 'password'}
                value={freshInbound}
                readOnly
                fullWidth
                className="font-mono text-sm"
              />
              <Button
                size="sm"
                variant="secondary"
                onPress={() => setShowInbound((v) => !v)}
                aria-label={showInbound ? 'Hide key' : 'Show key'}
              >
                {showInbound ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="secondary" onPress={copyInbound}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? ' Copied' : ' Copy'}
              </Button>
            </div>
          )}
          <div>
            <Button size="sm" variant="primary" isDisabled={busy} onPress={generateInbound}>
              {status?.inboundConfigured ? 'Generate new inbound key' : 'Generate inbound key'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <Label>Outbound API key (gx-portal sends on callbacks)</Label>
          <p className="text-xs text-muted">
            Paste the key the external portal shows under <strong>Inbound API key</strong>.
            {status?.outboundConfigured && status.outboundPreview
              ? ` Saved: ${status.outboundPreview}`
              : ' Not configured.'}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
              <Input
                type={showOutbound ? 'text' : 'password'}
                value={outboundDraft}
                onChange={(e) => setOutboundDraft(e.target.value)}
                placeholder="Paste external portal inbound key"
                fullWidth
                className="font-mono text-sm"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => setShowOutbound((v) => !v)}
              aria-label={showOutbound ? 'Hide key' : 'Show key'}
            >
              {showOutbound ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="primary" isDisabled={busy} onPress={saveOutbound}>
              Save
            </Button>
          </div>
        </div>

        {msg && (
          <p className={msg.ok ? 'text-sm text-success' : 'text-sm text-danger'}>{msg.text}</p>
        )}
      </div>
    </Section>
  );
}

export function ConfigPageClient() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null));
  }, []);

  return (
    <div>
      <PageHeader
        title="Configuration"
        description="Portal and gx-daemon connection, classification source, AI provider, pipeline options, and external portal keys."
      />
      <div className="flex flex-col gap-6">
        <DaemonConnectionSection />
        {isAdmin ? <ClassificationSourceSection /> : null}
        <AiProviderSection />
        <PipelineOptionsSection />
        {isAdmin ? <ExternalPortalKeysSection /> : null}
      </div>
    </div>
  );
}
