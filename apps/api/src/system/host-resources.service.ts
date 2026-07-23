import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';

@Injectable()
export class HostResourcesService {
  getCpuUsage(): { core: number; usage: number }[] {
    try {
      const lines = fs.readFileSync('/proc/stat', 'utf8').split('\n');
      return lines
        .filter((l) => /^cpu\d+/.test(l))
        .map((l) => {
          const parts = l.trim().split(/\s+/);
          const core = parseInt(parts[0].replace('cpu', ''), 10);
          const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0] =
            parts.slice(1).map(Number);
          const total = user + nice + system + idle + iowait + irq + softirq;
          const usage = total > 0 ? Math.round(((total - idle) / total) * 100) : 0;
          return { core, usage };
        });
    } catch {
      return os.cpus().map((_, i) => ({ core: i, usage: 0 }));
    }
  }

  getMemory(): { total: number; used: number; free: number; cached: number; usedPercent: number } {
    try {
      const content = fs.readFileSync('/proc/meminfo', 'utf8');
      const parse = (key: string): number => {
        const m = content.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
        return m ? parseInt(m[1], 10) * 1024 : 0;
      };
      const total = parse('MemTotal');
      const free = parse('MemFree');
      const cached = parse('Cached') + parse('Buffers');
      const used = total - free - cached;
      const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0;
      return { total, used, free, cached, usedPercent };
    } catch {
      const total = os.totalmem();
      const free = os.freemem();
      return { total, used: total - free, free, cached: 0, usedPercent: Math.round(((total - free) / total) * 100) };
    }
  }

  getDisk(): { path: string; total: number; used: number; free: number; usedPercent: number }[] {
    try {
      const { execSync } = require('child_process');
      const output: string = execSync('df -Pk / /home /data /tmp 2>/dev/null', { encoding: 'utf8' });
      const seen = new Set<string>();
      return output
        .split('\n')
        .slice(1)
        .filter(Boolean)
        .filter((line) => {
          const path = line.trim().split(/\s+/)[5];
          if (seen.has(path)) return false;
          seen.add(path);
          return true;
        })
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          const total = parseInt(parts[1], 10) * 1024;
          const used = parseInt(parts[2], 10) * 1024;
          const free = parseInt(parts[3], 10) * 1024;
          const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0;
          return { path: parts[5], total, used, free, usedPercent };
        });
    } catch {
      return [];
    }
  }

  getAll() {
    return {
      cpu: this.getCpuUsage(),
      memory: this.getMemory(),
      disk: this.getDisk(),
      timestamp: new Date().toISOString(),
    };
  }
}
