// Bridges the page to an optional host runtime (a Claude Artifact injects window.claude).
// Everywhere else window.claude does not exist and every function still resolves sensibly.
const cap = name => (window.claude && typeof window.claude.use === 'function') ? Promise.resolve().then(() => window.claude.use(name)).catch(() => null) : Promise.resolve(null);
// AI design is switched off (12 Nov, user: pressing the design button must never use Claude tokens): the 'sample'
// capability is not even requested, so aiAvailable() is always false and askDesigns() always returns null.
const samplePromise = Promise.resolve(null), downloadsPromise = cap('downloads');
export const inClaude = !!(window.claude && window.claude.use);
export async function aiAvailable() { return !!(await samplePromise); }
export async function askDesigns(prompt, { image = null, fresh = false } = {}) {
  const sample = await samplePromise; if (!sample) return null;
  const opts = { modelTier: 'quick' }; if (fresh) opts.cache = false;
  try {
    if (image && typeof sample.limits === 'function') { const lim = await sample.limits().catch(() => null); if (lim && lim.images) opts.images = [image]; }
    return await sample.json(prompt, opts);
  } catch (e) { return null; }
}
export async function saveFile(blob, filename) {
  if (inClaude) {
    const d = await downloadsPromise;
    if (d) { try { await d.save({ filename, data: blob }); return 'saved'; } catch (e) { return e && e.code === 'declined' ? 'declined' : 'manual'; } }
    return 'manual';
  }
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); return 'saved';
}
