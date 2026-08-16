/**
 * Terminal prompts, with the password never echoed.
 *
 * An earlier version used readline for both, which prints whatever is typed. That is a problem
 * beyond shoulder-surfing: running these scripts inside an agent session, a CI log, or anything
 * else that captures terminal output would put the password into a transcript.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ENTER = ['\r', '\n', '\u0004'];
const CTRL_C = '\u0003';
const BACKSPACE = ['\u007f', '\b'];

/** Line-based and echoed. Fine for a username. */
export async function ask(question) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/**
 * Reads without echoing. Requires a TTY.
 *
 * On non-TTY stdin this REFUSES rather than falling back to an echoing read. A silent fallback
 * would defeat the whole point of the function in exactly the case where it matters most: an
 * automated runner that captures output.
 */
export function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      reject(new Error(
        'refusing to read a password from non-interactive input: it cannot be hidden there. ' +
        'Run this script directly in a terminal.',
      ));
      return;
    }

    stdout.write(question);
    const wasRaw = stdin.isRaw ?? false;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let buf = '';
    const finish = (value, err) => {
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      if (err) reject(err);
      else resolve(value);
    };

    const onData = (chunk) => {
      const s = String(chunk);
      if (s === CTRL_C) return finish(null, new Error('cancelled'));
      if (BACKSPACE.includes(s)) {
        buf = buf.slice(0, -1);
        return;
      }
      for (const c of s) {
        if (ENTER.includes(c)) return finish(buf);   // also handles a paste ending in a newline
        if (c >= ' ') buf += c;
      }
    };

    stdin.on('data', onData);
  });
}
