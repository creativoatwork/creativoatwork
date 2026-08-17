#!/usr/bin/env node
/**
 * Frees the emulator ports before an e2e run.
 *
 * The Firebase emulators do not always shut down cleanly when a Playwright run is interrupted,
 * and the next run then dies with "Could not start Firestore Emulator, port taken" — which looks
 * like a config problem and is not. This makes the suite re-runnable without manual cleanup.
 */
import { execFileSync } from 'node:child_process';

const PORTS = [3009, 8080, 9099, 4400, 4500];

for (const port of PORTS) {
  let pids = [];
  try {
    pids = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    continue;   // lsof exits non-zero when nothing holds the port
  }
  for (const pid of pids) {
    let name = 'unknown';
    try {
      name = execFileSync('ps', ['-p', pid, '-o', 'comm='], { encoding: 'utf8' }).trim();
    } catch { /* already gone */ }

    // Never kill something that merely happens to share a port with us — macOS binds 5000 with
    // ControlCenter, and the same class of collision could happen elsewhere.
    if (!/java|node|firebase/i.test(name)) {
      console.warn(`free-ports: port ${port} held by ${name} (pid ${pid}) — leaving it alone`);
      continue;
    }
    try {
      process.kill(Number(pid), 'SIGKILL');
      console.log(`free-ports: freed ${port} (was ${name}, pid ${pid})`);
    } catch { /* raced with its own exit */ }
  }
}
