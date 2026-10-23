import { packager } from '@electron/packager';
import { fileURLToPath } from 'node:url';

const paths = await packager({
  dir: fileURLToPath(new URL('..', import.meta.url)),
  out: fileURLToPath(new URL('../dist', import.meta.url)),
  name: '蓝色大肥鱼',
  executableName: 'BlueDaFeiYu',
  appBundleId: 'local.blue-dafeiyu.codex',
  appVersion: '0.1.0',
  platform: 'darwin',
  arch: 'arm64',
  electronVersion: '43.3.0',
  electronZipDir: process.env.ELECTRON_ZIP_DIR,
  asar: false,
  overwrite: true,
  prune: true,
  ignore: [/^\/qa($|\/)/, /^\/tests($|\/)/, /^\/scripts($|\/)/, /^\/dist($|\/)/, /^\/\.git($|\/)/, /^\/src\/vendor($|\/)/],
  extendInfo: { LSUIElement: true, NSHighResolutionCapable: true, CFBundleDisplayName: '蓝色大肥鱼' },
});
console.log(paths.join('\n'));
