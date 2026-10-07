const assert = require('node:assert/strict');
const { supportsFriendlyAssets, friendlyAssets, assetNamed, assertExactCopy } = require('./friendly-release-assets.cjs');

// Shared by release.yml and the manual validator. Only read-only GitHub APIs.
module.exports = async function validateRelease({ github, context, core }) {
  const results = [];
  const check = async (name, fn) => {
    try {
      const value = await fn();
      results.push({ name, status: 'PASS', detail: '' });
      core.info(`PASS: ${name}`);
      return value;
    } catch (error) {
      results.push({ name, status: 'FAIL', detail: error.message });
      core.error(`FAIL: ${name}: ${error.message}`);
    }
  };
  const skip = (name) => {
    results.push({ name, status: 'SKIP', detail: 'A prerequisite failed' });
    core.warning(`SKIP: ${name}: a prerequisite failed`);
  };
  const repo = context.repo;
  const tag = process.env.RELEASE_TAG;
  const releaseIdText = process.env.RELEASE_ID;
  const releaseId = await check('Repository, release ID and tag', () => {
    assert.equal(`${repo.owner}/${repo.repo}`, 'AlejandroNes/minimg');
    assert.match(releaseIdText || '', /^[1-9]\d*$/);
    const id = Number(releaseIdText);
    assert.ok(Number.isSafeInteger(id), 'Invalid release ID');
    assert.match(tag || '', /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
    return id;
  });
  const downloadText = async (asset) => {
    const { data } = await github.rest.repos.getReleaseAsset({
      ...repo, asset_id: asset.id, headers: { accept: 'application/octet-stream' },
    });
    return typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
  };
  const taggedJson = async (path) => {
    const { data } = await github.rest.repos.getContent({ ...repo, path, ref: tag });
    assert.equal(data.type, 'file', `Expected a tagged file: ${path}`);
    assert.equal(data.encoding, 'base64');
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  };

  if (releaseId) {
    const release = await check('Authenticated access to draft release', async () => {
      const { data } = await github.rest.repos.getRelease({ ...repo, release_id: releaseId });
      return data;
    });
    if (release) {
      await check('Release ID, tag and draft status', () => {
        assert.equal(release.id, releaseId);
        assert.equal(release.tag_name, tag);
        assert.equal(release.draft, true, 'Release must remain a draft');
        assert.equal(release.prerelease, false);
      });
    } else skip('Release ID, tag and draft status');

    const metadata = await check('Application metadata from the release tag', async () => {
      const pkg = await taggedJson('package.json');
      const config = await taggedJson('src-tauri/tauri.conf.json');
      assert.equal(tag, `v${pkg.version}`, 'Tag/application version mismatch');
      assert.equal(config.version, '../package.json');
      assert.equal(config.productName, 'Minimg');
      assert.equal(config.bundle.createUpdaterArtifacts, true);
      return { version: pkg.version, productName: config.productName };
    });
    const assets = await check('Authenticated access to release assets', async () => {
      const data = await github.paginate(github.rest.repos.listReleaseAssets, {
        ...repo, release_id: releaseId, per_page: 100,
      });
      core.info(`Release contains ${data.length} assets`);
      return data;
    });
    if (assets) {
      const version = tag.slice(1);
      const name = `${metadata?.productName || 'Minimg'}_${version}`;
      const platforms = [
        { key: 'darwin-aarch64', stem: `${name}_darwin_aarch64`, installer: 'app', ext: '.app.tar.gz' },
        { key: 'darwin-x86_64', stem: `${name}_darwin_x64`, installer: 'app', ext: '.app.tar.gz' },
        { key: 'windows-x86_64', stem: `${name}_windows_x64`, installer: 'nsis', ext: '-setup.exe' },
      ];
      const manifest = await check('Download and parse uploaded latest.json', async () => {
        const value = JSON.parse(await downloadText(assetNamed(assets, 'latest.json')));
        assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Invalid manifest object');
        return value;
      });
      if (manifest) {
        await check('Manifest version', () => assert.equal(manifest.version, version));
        await check('Manifest publication date', () => {
          assert.equal(typeof manifest.pub_date, 'string');
          assert.match(manifest.pub_date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
          assert.ok(Number.isFinite(Date.parse(manifest.pub_date)), 'Invalid publication date');
        });
        await check('Manifest platforms object', () => {
          assert.ok(manifest.platforms && typeof manifest.platforms === 'object' && !Array.isArray(manifest.platforms));
        });
      } else skip('Manifest version, publication date and platforms object');

      const validateUpdater = async (stem, ext, keys) => {
        const asset = await check(`Updater asset: ${stem}${ext}`, () => assetNamed(assets, stem + ext));
        const signature = await check(`Uploaded signature: ${stem}${ext}.sig`, async () => {
          const text = (await downloadText(assetNamed(assets, stem + ext + '.sig'))).trim();
          assert.ok(text, 'Empty signature');
          return text;
        });
        for (const key of keys) {
          if (!manifest) { skip(`Platform ${key}: presence, URL and signature`); continue; }
          const entry = await check(`Platform ${key}: present`, () => {
            const value = manifest.platforms?.[key];
            assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Missing/invalid updater platform');
            return value;
          });
          if (entry && asset) {
            await check(`Platform ${key}: URL matches uploaded asset`, () => {
              // tauri-action v1 currently uses asset API URLs; accept the exact tagged download URL too.
              assert.ok([asset.url, asset.browser_download_url].includes(entry.url), 'Wrong updater asset URL');
              assert.equal(new URL(entry.url).protocol, 'https:');
            });
          } else skip(`Platform ${key}: URL matches uploaded asset`);
          if (entry && signature) {
            await check(`Platform ${key}: signature matches .sig`, () => {
              assert.equal(typeof entry.signature, 'string', 'Invalid signature type');
              assert.equal(entry.signature.trim(), signature, 'Signature mismatch');
            });
          } else skip(`Platform ${key}: signature matches .sig`);
        }
      };
      if (supportsFriendlyAssets(tag)) {
        for (const { source, name: friendlyName } of friendlyAssets(tag)) {
          await check(`Friendly installer ${friendlyName}: exact SHA-256 copy of ${source}`, async () => {
            const original = assetNamed(assets, source);
            const copy = assetNamed(assets, friendlyName);
            await assertExactCopy(github, repo, original, copy);
          });
        }
      } else {
        core.info(`Friendly installers are not required for historical release ${tag}`);
      }

      for (const { key, stem, installer, ext } of platforms) {
        const installerExt = installer === 'app' ? '.dmg' : '.msi';
        await check(`Installer: ${stem}${installerExt}`, () => assetNamed(assets, stem + installerExt));
        await validateUpdater(stem, ext, [key, `${key}-${installer}`]);
        if (installer === 'nsis') await validateUpdater(stem, '.msi', [`${key}-msi`]);
      }
    } else skip('Installers, latest.json, platform URLs and signatures');
  } else skip('Draft release, metadata and assets');

  const counts = (status) => results.filter((result) => result.status === status).length;
  const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;').replace(/[\r\n]+/g, ' ');
  await core.summary
    .addHeading(`Draft release validation: ${tag || 'invalid tag'}`)
    .addRaw(`Release ID: ${escape(releaseIdText)} — PASS: ${counts('PASS')}, FAIL: ${counts('FAIL')}, SKIP: ${counts('SKIP')}\n\n`)
    .addTable([
      [{ data: 'Check', header: true }, { data: 'Result', header: true }, { data: 'Details', header: true }],
      ...results.map(({ name, status, detail }) => [escape(name), status, escape(detail)]),
    ])
    .write();
  if (counts('FAIL') || counts('SKIP')) core.setFailed(`Draft validation failed: ${counts('FAIL')} failed, ${counts('SKIP')} skipped`);
  return results;
};
