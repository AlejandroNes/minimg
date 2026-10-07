const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

function supportsFriendlyAssets(tag) {
  assert.match(tag || '', /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  const [major, minor, patch] = tag.slice(1).split('.').map(BigInt);
  return major > 1n || (major === 1n && (minor > 0n || patch > 0n));
}

function friendlyAssets(tag) {
  assert.match(tag || '', /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  const stem = `Minimg_${tag.slice(1)}`;
  return [
    { source: `${stem}_windows_x64-setup.exe`, name: 'Minimg-Windows.exe', contentType: 'application/vnd.microsoft.portable-executable' },
    { source: `${stem}_darwin_aarch64.dmg`, name: 'Minimg-macOS-Apple-Silicon.dmg', contentType: 'application/x-apple-diskimage' },
    { source: `${stem}_darwin_x64.dmg`, name: 'Minimg-macOS-Intel.dmg', contentType: 'application/x-apple-diskimage' },
  ];
}

function assetNamed(assets, name) {
  const matches = assets.filter((asset) => asset.name === name);
  assert.equal(matches.length, 1, `Expected exactly one asset: ${name}`);
  const asset = matches[0];
  assert.equal(asset.state, 'uploaded', `Asset not uploaded: ${name}`);
  assert.ok(Number.isSafeInteger(asset.size) && asset.size > 0, `Empty/invalid asset: ${name}`);
  return asset;
}

async function downloadBuffer(github, repo, asset) {
  const { data } = await github.rest.repos.getReleaseAsset({
    ...repo, asset_id: asset.id, headers: { accept: 'application/octet-stream' },
  });
  assert.ok(Buffer.isBuffer(data) || data instanceof ArrayBuffer || ArrayBuffer.isView(data), 'Expected binary asset response');
  const bytes = Buffer.isBuffer(data) ? data : ArrayBuffer.isView(data)
    ? Buffer.from(data.buffer, data.byteOffset, data.byteLength) : Buffer.from(data);
  assert.equal(bytes.length, asset.size, `Downloaded size mismatch: ${asset.name}`);
  return bytes;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function assertExactCopy(github, repo, source, copy, sourceBytes) {
  assert.equal(copy.size, source.size, `Installer size mismatch: ${copy.name}`);
  const original = sourceBytes || await downloadBuffer(github, repo, source);
  const duplicate = await downloadBuffer(github, repo, copy);
  assert.equal(sha256(duplicate), sha256(original), `Installer SHA-256 mismatch: ${copy.name}`);
}

// This is the only writer. It can replace only these three allowlisted names in a draft.
async function uploadFriendlyAssets({ github, context, core }) {
  const repo = context.repo;
  const tag = process.env.RELEASE_TAG;
  assert.equal(`${repo.owner}/${repo.repo}`, 'AlejandroNes/minimg');
  if (!supportsFriendlyAssets(tag)) {
    core.info(`Friendly installer copies are enabled from v1.0.1; leaving ${tag} untouched`);
    return;
  }
  assert.match(process.env.RELEASE_ID || '', /^[1-9]\d*$/);
  const release_id = Number(process.env.RELEASE_ID);
  assert.ok(Number.isSafeInteger(release_id));
  const releaseParams = { ...repo, release_id };
  const assertDraft = async () => {
    const { data } = await github.rest.repos.getRelease(releaseParams);
    assert.equal(data.id, release_id);
    assert.equal(data.tag_name, tag);
    assert.equal(data.draft, true, 'Friendly installers may only be uploaded to a draft');
    assert.equal(data.prerelease, false);
    return data;
  };
  const release = await assertDraft();
  const listAssets = () => github.paginate(github.rest.repos.listReleaseAssets, { ...releaseParams, per_page: 100 });
  // Preflight all sources before writing any friendly assets.
  const initialAssets = await listAssets();
  const plans = friendlyAssets(tag).map((plan) => ({ ...plan, original: assetNamed(initialAssets, plan.source) }));
  for (const { source, name, contentType, original } of plans) {
    const bytes = await downloadBuffer(github, repo, original);
    // Re-list after every upload error: a timeout may occur after GitHub accepted the asset.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const assets = await listAssets();
        const matches = assets.filter((asset) => asset.name === name);
        assert.ok(matches.length <= 1, `Duplicate friendly asset: ${name}`);
        if (matches.length) {
          try {
            const existing = assetNamed(assets, name);
            await assertExactCopy(github, repo, original, existing, bytes);
            core.info(`PASS: ${name} already matches ${source}; no upload needed`);
            break;
          } catch (error) {
            if (!(error instanceof assert.AssertionError)) throw error;
            core.info(`Replacing draft friendly copy ${name}: ${error.message}`);
          }
          await assertDraft();
          await github.rest.repos.deleteReleaseAsset({ ...repo, asset_id: matches[0].id });
        }
        await assertDraft();
        await github.rest.repos.uploadReleaseAsset({
          ...repo, release_id, url: release.upload_url,
          name, data: bytes,
          headers: { 'content-type': contentType, 'content-length': bytes.length },
        });
        const uploaded = assetNamed(await listAssets(), name);
        await assertExactCopy(github, repo, original, uploaded, bytes);
        core.info(`PASS: ${name} is an exact SHA-256 copy of ${source}`);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        core.warning(`Friendly installer attempt ${attempt} failed for ${name}: ${error.message}`);
      }
    }
  }
}

module.exports = { supportsFriendlyAssets, friendlyAssets, assetNamed, downloadBuffer, assertExactCopy, uploadFriendlyAssets };
