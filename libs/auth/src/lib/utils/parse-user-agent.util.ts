import { UAParser } from 'ua-parser-js';

import type { IParsedUserAgent } from './parsed-user-agent.interface';

export function parseUserAgent(raw: string | null | undefined): IParsedUserAgent | null {
  if (!raw?.trim()) return null;

  const parser = new UAParser(raw);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  const major = browser.version?.split('.')[0];
  const browserSuffix = major ? ` ${major}` : '';
  const browserStr = browser.name ? `${browser.name}${browserSuffix}` : null;

  const osSuffix = os.version ? ` ${os.version}` : '';
  const osStr = os.name ? `${os.name}${osSuffix}` : null;

  let deviceStr: string | null = null;
  if (device.type) {
    deviceStr = device.type.charAt(0).toUpperCase() + device.type.slice(1);
  } else if (os.name) {
    deviceStr = 'Desktop';
  }

  return { browser: browserStr, os: osStr, device: deviceStr };
}
