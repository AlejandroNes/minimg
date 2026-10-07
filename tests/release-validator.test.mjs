import assert from 'node:assert/strict';
import { test } from 'node:test';
import validateRelease from '../scripts/validate-release.cjs';

function fixture() {
  const assets = [];
  const contents = new Map();
  const requests = [];
  const failures = [];
  const logs = [];
  const add = (name, text = 'installer') => {
    const id = assets.length + 1;
    const asset = {
      id, name, state: 'uploaded', size: text.length,
      url: `https://api.github.com/repos/AlejandroNes/minimg/releases/assets/${id}`,
      browser_download_url: `https://github.com/AlejandroNes/minimg/releases/download/v1.0.0/${name}`,
    };
    assets.push(asset);
    contents.set(id, text);
    return asset;
  };
  const manifest = { version: '1.0.0', pub_date: '2026-10-06T12:00:00.000Z', platforms: {} };
  for (const [key, stem, installer, ext] of [
    ['darwin-aarch64', 'Minimg_1.0.0_darwin_aarch64', 'app', '.app.tar.gz'],
    ['darwin-x86_64', 'Minimg_1.0.0_darwin_x64', 'app', '.app.tar.gz'],
    ['windows-x86_64', 'Minimg_1.0.0_windows_x64', 'nsis', '-setup.exe'],
  ]) {
    add(stem + (installer === 'app' ? '.dmg' : '.msi'));
    const updater = add(stem + ext);
    add(stem + ext + '.sig', `signature-${key}\n`);
    const entry = { url: updater.url, signature: `signature-${key}\n` };
    manifest.platforms[key] = { ...entry };
    manifest.platforms[`${key}-${installer}`] = { ...entry };
    if (installer === 'nsis') {
      const msi = assets.find((asset) => asset.name === stem + '.msi');
      add(stem + '.msi.sig', 'signature-msi\n');
      manifest.platforms[`${key}-msi`] = { url: msi.url, signature: 'signature-msi\n' };
    }
  }
  const latest = add('latest.json', JSON.stringify(manifest));
  const release = { id: 405276548, tag_name: 'v1.0.0', draft: true, prerelease: false };
  const api = (name, fn) => async (params) => {
    requests.push({ name, params });
    return fn(params);
  };
  const github = {
    rest: { repos: {
      getRelease: api('getRelease', () => ({ data: release })),
      getReleaseAsset: api('getReleaseAsset', ({ asset_id, headers }) => {
        assert.equal(headers.accept, 'application/octet-stream');
        return { data: Buffer.from(contents.get(asset_id)) };
      }),
      getContent: api('getContent', ({ path, ref }) => {
        assert.equal(ref, 'v1.0.0');
        const value = path === 'package.json' ? { version: '1.0.0' } : {
          version: '../package.json', productName: 'Minimg', bundle: { createUpdaterArtifacts: true },
        };
        return { data: { type: 'file', encoding: 'base64', content: Buffer.from(JSON.stringify(value)).toString('base64') } };
      }),
      listReleaseAssets: api('listReleaseAssets', () => assets),
    } },
    paginate: async (method, params) => method(params),
  };
  const summary = {
    addHeading() { return this; }, addRaw() { return this; },
    addTable(rows) { this.rows = rows; return this; }, async write() { this.written = true; },
  };
  const core = {
    info: (text) => logs.push(text), error: (text) => logs.push(text), warning: (text) => logs.push(text),
    setFailed: (text) => failures.push(text), summary,
  };
  const run = async () => {
    const previous = { id: process.env.RELEASE_ID, tag: process.env.RELEASE_TAG };
    process.env.RELEASE_ID = '405276548';
    process.env.RELEASE_TAG = 'v1.0.0';
    try {
      contents.set(latest.id, JSON.stringify(manifest));
      return await validateRelease({ github, core, context: { repo: { owner: 'AlejandroNes', repo: 'minimg' } } });
    } finally {
      for (const [key, value] of [['RELEASE_ID', previous.id], ['RELEASE_TAG', previous.tag]]) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  };
  return { assets, contents, latest, manifest, release, github, failures, requests, summary, run };
}

test('validates 11 draft assets with tagged metadata and read-only authenticated APIs', async () => {
  const f = fixture();
  const before = structuredClone({ assets: f.assets, release: f.release });
  assert.equal(f.assets.length, 11);
  const results = await f.run();
  assert.ok(results.length > 30);
  assert.ok(results.every((result) => result.status === 'PASS'));
  assert.deepEqual(f.failures, []);
  assert.deepEqual({ assets: f.assets, release: f.release }, before);
  assert.ok(f.summary.written);
  assert.ok(f.requests.every(({ name }) => ['getRelease', 'getContent', 'getReleaseAsset', 'listReleaseAssets'].includes(name)));
});

test('reports multiple independent failures and still checks later platforms', async () => {
  const f = fixture();
  f.assets.splice(f.assets.findIndex((asset) => asset.name.endsWith('_darwin_aarch64.dmg')), 1);
  f.manifest.platforms['darwin-aarch64'].signature = 'wrong';
  f.manifest.platforms['windows-x86_64'].url = 'https://example.com/setup.exe';
  const results = await f.run();
  assert.equal(results.filter((result) => result.status === 'FAIL').length, 3);
  assert.ok(results.some((result) => result.name === 'Platform windows-x86_64-msi: signature matches .sig' && result.status === 'PASS'));
  assert.equal(f.failures.length, 1);
  assert.ok(f.summary.written);
});

test('rejects missing platforms, empty signatures and invalid signature types', async () => {
  const f = fixture();
  delete f.manifest.platforms['darwin-x86_64-app'];
  f.manifest.platforms['darwin-aarch64'].signature = 123;
  const sig = f.assets.find((asset) => asset.name.endsWith('-setup.exe.sig'));
  f.contents.set(sig.id, '  \n');
  const results = await f.run();
  assert.ok(results.filter((result) => result.status === 'FAIL').length >= 3);
  assert.equal(f.failures.length, 1);
});

test('rejects wrong draft identity and manifest version/date', async () => {
  const f = fixture();
  f.release.draft = false;
  f.manifest.version = '2.0.0';
  f.manifest.pub_date = 123;
  const results = await f.run();
  assert.equal(results.filter((result) => result.status === 'FAIL').length, 3);
});

test('reports denied draft access and continues independent checks', async () => {
  const f = fixture();
  f.github.rest.repos.getRelease = async () => { throw new Error('Resource not accessible by integration'); };
  const results = await f.run();
  assert.ok(results.some((result) => result.status === 'FAIL' && result.detail.includes('Resource not accessible')));
  assert.ok(results.some((result) => result.name === 'Manifest version' && result.status === 'PASS'));
  assert.ok(f.summary.written);
  assert.equal(f.failures.length, 1);
});

test('rejects duplicate, empty and incomplete installer assets', async () => {
  const f = fixture();
  f.assets.push({ ...f.assets.find((asset) => asset.name.endsWith('_darwin_x64.dmg')) });
  f.assets.find((asset) => asset.name.endsWith('_darwin_aarch64.dmg')).size = 0;
  f.assets.find((asset) => asset.name.endsWith('.msi')).state = 'new';
  const results = await f.run();
  assert.ok(results.filter((result) => result.status === 'FAIL').length >= 3);
});
