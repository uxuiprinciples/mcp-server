#!/usr/bin/env node
/**
 * Post-build smoke test that would have caught the "data files missing from
 * package" bug (v1.1.2 / v1.1.3): it packs the built package, installs the
 * tarball into a fresh temp project, and runs the server with cwd set to that
 * temp dir (deliberately NOT the repo root — the cwd fallbacks masked the bug
 * locally). Every tool must return success. Exits non-zero on any failure so
 * prepack/publish aborts.
 *
 * Two runs of the installed server:
 *  1. free mode (no UXUI_API_KEY): every tool answers from the bundled data,
 *     detect_smell finds each smell from one realistic EN and one ES sentence
 *     (SMELL_FIXTURES) and from its own keywords, audit_interface refuses
 *     with PRO_REQUIRED, and the fake API receives zero requests.
 *  2. pro mode (UXUI_API_KEY set, UXUI_API_BASE_URL pointed at a local fake
 *     of /api/v1): get_principle carries the guide body, get_principle_prompts
 *     the prompts, audit_interface the findings, and every request carried
 *     the Bearer key and the uxui-mcp user agent.
 *
 * Assumes the package is already built (prepack builds before calling this).
 * Uses `npm pack --ignore-scripts` so it does not re-trigger prepack.
 */

import { execSync } from 'child_process';
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_TOOLS = 13;
// The catalogue size comes from the data package the server bundles, never a
// hand-typed number (185 went stale the day Part 6 shipped).
const { PRINCIPLE_COUNT: MIN_PRINCIPLES, loadSmells } = await import('@uxuiprinciples/principles-data');
// The keyword map and fixtures are read from the built bundle (a side-effect
// free entry next to the server), the same code the tarball ships, so the
// assertions cannot drift from what runs.
const keywordsEntry = ['dist/tools/smell-keywords.mjs', 'dist/smell-keywords.mjs']
  .map((p) => path.join(PKG_DIR, p))
  .find((p) => fs.existsSync(p));
if (!keywordsEntry) fail('built smell-keywords entry not found under dist/');
const { SMELL_KEYWORDS, SMELL_FIXTURES } = await import(keywordsEntry);

const FAKE_KEY = 'uxui_test_key_for_smoke';
const FAKE_BODY = '# Full guide body\n\nServed by the smoke-test fake API.';
const FAKE_PROMPTS = ['Prompt one from the guide', 'Prompt two from the guide'];

function fail(msg) {
  console.error(`\n  smoke-test FAILED: ${msg}\n`);
  process.exit(1);
}

// 1. Pack the already-built package (no script recursion) and install into a temp project.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-smoke-'));
console.log(`smoke-test: temp project ${tmp}`);
const tarball = execSync('npm pack --ignore-scripts --silent', { cwd: PKG_DIR }).toString().trim().split('\n').pop();
const tarballPath = path.join(PKG_DIR, tarball);
try {
  execSync('npm init -y', { cwd: tmp, stdio: 'ignore' });
  execSync(`npm install --silent "${tarballPath}"`, { cwd: tmp, stdio: 'ignore' });
} finally {
  fs.rmSync(tarballPath, { force: true });
}

const serverEntry = path.join(tmp, 'node_modules', '@uxuiprinciples', 'mcp-server', 'dist', 'index.js');
if (!fs.existsSync(serverEntry)) fail(`server entry not found at ${serverEntry}`);

// 2. A fake /api/v1 for the pro run. Records every request it sees.
const apiRequests = [];
const fakeApi = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    apiRequests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), auth: req.headers.authorization, ua: req.headers['user-agent'], body });
    const send = (status, payload) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    if (req.headers.authorization !== `Bearer ${FAKE_KEY}`) {
      return send(401, { success: false, error: { code: 'INVALID_API_KEY', message: 'bad key' } });
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/principles') {
      const slug = url.searchParams.get('slug');
      if (slug === 'does-not-exist') return send(404, { success: false, error: { code: 'NOT_FOUND', message: 'nope' } });
      return send(200, {
        success: true,
        data: { slug, title: 'Fake', code: 'X.0.0.00', part: 'part-1', partName: 'Foundations', difficulty: 'beginner', readTime: 5, content: FAKE_BODY, frontmatter: { vibeCodingPrompts: FAKE_PROMPTS } },
        meta: { tier: 'pro' },
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/audit') {
      const parsed = JSON.parse(body || '{}');
      return send(200, {
        success: true,
        data: {
          interface_type: 'form', overall_score: 72, band: 'fair',
          findings: [{ id: 'finding-1', principle: { code: 'F.1.1.02', slug: 'cognitive-load', title: 'Cognitive Load', part: 'part-1' }, severity: 'warning', message: `echo: ${parsed.description.slice(0, 20)}`, remediation: 'fix it', business_impact: null, smell_id: 'overloaded-screen' }],
          smells_detected: ['overloaded-screen'], strengths: [], priority_fixes: ['finding-1'], audit_depth: parsed.depth ?? 'full',
        },
        meta: { tier: 'pro' },
      });
    }
    send(404, { success: false, error: { code: 'NOT_FOUND', message: `no route ${req.method} ${url.pathname}` } });
  });
});
await new Promise((resolve) => fakeApi.listen(0, '127.0.0.1', resolve));
const fakeBase = `http://127.0.0.1:${fakeApi.address().port}`;

// 3. Drive the server over stdio JSON-RPC with cwd = temp dir (NOT the repo).
function startServer(extraEnv) {
  const env = { ...process.env, ...extraEnv };
  delete env.UXUI_API_KEY;
  if (extraEnv.UXUI_API_KEY) env.UXUI_API_KEY = extraEnv.UXUI_API_KEY;
  const child = spawn('node', [serverEntry], { cwd: tmp, env, stdio: ['pipe', 'pipe', 'inherit'] });
  const pending = new Map();
  let nextId = 1;
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d.toString();
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id != null && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch { /* ignore non-JSON */ }
    }
  });

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        stop();
        fail(`no response for ${method} (id ${id}) within 15s`);
      }, 15000);
      pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  function result(msg, label) {
    if (!msg.result) fail(`${label} returned no result: ${JSON.stringify(msg.error || msg)}`);
    return msg.result;
  }
  async function call(name, args) {
    return result(await request('tools/call', { name, arguments: args }), `tools/call ${name}`);
  }
  async function payload(name, args) {
    const res = await call(name, args);
    if (res.isError) fail(`tool call ${name} returned isError: ${res.content?.[0]?.text?.slice(0, 200)}`);
    return JSON.parse(res.content[0].text);
  }
  function stop() {
    child.stdin.end();
    child.kill();
  }
  async function init() {
    const initRes = result(await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '1.0' } }), 'initialize');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return initRes;
  }
  return { request, result, call, payload, stop, init };
}

function cleanup() {
  fakeApi.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Run 1: free mode
// ---------------------------------------------------------------------------
{
  const s = startServer({ UXUI_API_BASE_URL: fakeBase });
  const init = await s.init();
  if (!/Free mode/.test(init.instructions ?? '')) fail('free-mode instructions should say "Free mode"');

  const tools = s.result(await s.request('tools/list', {}), 'tools/list').tools;
  if (!Array.isArray(tools) || tools.length !== EXPECTED_TOOLS) fail(`expected ${EXPECTED_TOOLS} tools, got ${tools?.length}`);
  if (!tools.every((t) => t.annotations?.readOnlyHint === true)) fail('not all tools have readOnlyHint annotation');

  const en = await s.payload('list_principles', { locale: 'en', limit: 500 });
  if (!en.success || (en.total ?? en.principles?.length ?? 0) < MIN_PRINCIPLES) fail(`EN principles: ${JSON.stringify(en).slice(0, 120)}`);
  const es = await s.payload('list_principles', { locale: 'es', limit: 500 });
  if (!es.success || (es.total ?? es.principles?.length ?? 0) < MIN_PRINCIPLES) fail(`ES principles: ${JSON.stringify(es).slice(0, 120)}`);

  const smells = await s.payload('list_smells', {});
  if (!smells.success || !(smells.smells?.length > 0)) fail(`list_smells: ${JSON.stringify(smells).slice(0, 120)}`);
  if (!(await s.payload('get_smell', { id: 'contrast-blindness' })).success) fail('get_smell failed');

  // Every smell must be detectable from a realistic sentence in both
  // languages (SMELL_FIXTURES) and, as a wiring check, from its own first EN
  // and ES keyword.
  const catalogue = loadSmells();
  const misses = [];
  for (const smell of catalogue) {
    const keywords = SMELL_KEYWORDS[smell.id];
    const fixture = SMELL_FIXTURES[smell.id];
    if (!keywords?.length) { misses.push(`${smell.id} (no keywords)`); continue; }
    if (!fixture?.en || !fixture?.es) { misses.push(`${smell.id} (no fixture sentence)`); continue; }
    const esProbe = keywords.find((k) => /[áéíóúñ]/i.test(k) || /\b(sin|de|el|la|los|las|no|muy|por)\b/.test(k));
    if (!esProbe) { misses.push(`${smell.id} (no Spanish keyword)`); continue; }
    const probes = [['en', fixture.en], ['es', fixture.es], ['en', `Users report: ${keywords[0]}.`], ['es', `Los usuarios dicen: ${esProbe}.`]];
    for (const [lang, text] of probes) {
      const d = await s.payload('detect_smell', { description: text, locale: lang });
      if (!d.success || !d.detections?.some((x) => x.smell.id === smell.id)) misses.push(`${smell.id} (${lang}: "${text}")`);
    }
  }
  if (misses.length) fail(`detect_smell misses:\n  ${misses.join('\n  ')}`);

  const principle = await s.payload('get_principle', { slug: 'automation-bias-prevention', locale: 'en' });
  if (!principle.success || principle.tier !== 'free' || !principle.principle?.content?.includes('uxuiprinciples.com')) fail('free get_principle missing summary/link or tier');

  // Citations ship with the principle (bibliographic frontmatter, not the paywalled body).
  const hicks = await s.payload('get_principle', { slug: 'hicks-law', locale: 'en' });
  const cites = hicks.principle?.citations;
  if (!Array.isArray(cites) || cites.length === 0 || !cites[0].author || !cites[0].title) fail(`get_principle hicks-law should carry citations, got ${JSON.stringify(cites).slice(0, 120)}`);

  const prompts = await s.payload('get_principle_prompts', { slug: 'hicks-law' });
  if (!prompts.success || prompts.tier !== 'free' || prompts.prompts?.length !== 0 || !/UXUI_API_KEY/.test(prompts.note ?? '')) fail(`free get_principle_prompts should return no prompts and the key hint: ${JSON.stringify(prompts).slice(0, 160)}`);

  const audit = await s.call('audit_interface', { description: 'A signup form with twelve required fields and no inline validation.' });
  if (!audit.isError || !/PRO_REQUIRED|UXUI_API_KEY/.test(audit.content?.[0]?.text ?? '')) fail(`free audit_interface should refuse with the key hint: ${audit.content?.[0]?.text?.slice(0, 160)}`);
  const shortAudit = await s.call('audit_interface', { description: 'too short' });
  if (!shortAudit.isError) fail('audit_interface with a short description should fail validation');

  // part filter by name must work in search_principles (not only by "part-N" id).
  const byName = await s.payload('search_principles', { part: 'Foundations', locale: 'en' });
  if (!byName.success || !((byName.total ?? 0) > 0)) fail(`search_principles part-by-name: ${JSON.stringify(byName).slice(0, 120)}`);

  // limit <= 0 must fall back to the default, not silently return an empty list.
  const clamped = await s.payload('search_principles', { query: 'law', limit: 0, locale: 'en' });
  if (!clamped.success || !(clamped.results?.length > 0)) fail(`limit=0 should return results, got: ${JSON.stringify(clamped).slice(0, 120)}`);

  // principle titles must not carry the doubled-apostrophe data artifact.
  const fitts = await s.payload('get_principle', { slug: 'fitts-law', locale: 'en' });
  if (!fitts.success || fitts.principle?.title !== "Fitts's Law") fail(`title artifact: ${JSON.stringify(fitts.principle?.title)}`);

  // missing required arg must be rejected by input validation (isError).
  const badArgs = await s.call('get_principle', { arguments: 'missing slug' });
  if (!badArgs.isError) fail('get_principle without slug should return isError');

  s.stop();
  if (apiRequests.length !== 0) fail(`free mode must not touch the API, saw ${apiRequests.length} request(s)`);
  console.log(`smoke-test free mode OK: ${tools.length} tools, EN=${en.total} ES=${es.total} principles, ${catalogue.length} smells detected from fixtures and keywords in en+es, citations OK, audit refused, 0 API requests`);
}

// ---------------------------------------------------------------------------
// Run 2: pro mode against the fake API
// ---------------------------------------------------------------------------
{
  const s = startServer({ UXUI_API_KEY: FAKE_KEY, UXUI_API_BASE_URL: fakeBase });
  const init = await s.init();
  if (!/Pro mode/.test(init.instructions ?? '')) fail('pro-mode instructions should say "Pro mode"');

  const full = await s.payload('get_principle', { slug: 'hicks-law', locale: 'es' });
  if (!full.success || full.tier !== 'pro' || full.principle?.content !== FAKE_BODY) fail(`pro get_principle should carry the API body: ${JSON.stringify(full).slice(0, 200)}`);
  if (!Array.isArray(full.principle?.citations) || full.principle.citations.length === 0) fail('pro get_principle lost the bundled citations');

  const prompts = await s.payload('get_principle_prompts', { slug: 'hicks-law' });
  if (!prompts.success || prompts.tier !== 'pro' || JSON.stringify(prompts.prompts) !== JSON.stringify(FAKE_PROMPTS)) fail(`pro get_principle_prompts: ${JSON.stringify(prompts).slice(0, 200)}`);

  const audit = await s.payload('audit_interface', { description: 'A signup form with twelve required fields and no inline validation.', depth: 'quick', context: 'web' });
  if (!audit.success || audit.tier !== 'pro' || audit.audit?.findings?.length !== 1 || audit.audit.audit_depth !== 'quick') fail(`pro audit_interface: ${JSON.stringify(audit).slice(0, 200)}`);

  // An API miss degrades to the bundled answer with proError, not to an error.
  const degraded = await s.payload('get_principle', { slug: 'fitts-law' });
  if (!degraded.success || degraded.tier !== 'pro') fail('pro get_principle on a known slug failed');
  const unknownRemote = apiRequests.filter((r) => r.query?.slug === 'does-not-exist');
  if (unknownRemote.length) fail('unexpected request for an unknown slug');

  s.stop();
  const bad = apiRequests.filter((r) => r.auth !== `Bearer ${FAKE_KEY}` || !/^uxui-mcp\//.test(r.ua ?? ''));
  if (bad.length) fail(`pro requests without the Bearer key or the uxui-mcp user agent: ${JSON.stringify(bad[0])}`);
  const paths = apiRequests.map((r) => `${r.method} ${r.path}`);
  if (!paths.includes('GET /api/v1/principles') || !paths.includes('POST /api/v1/audit')) fail(`pro run did not hit the expected routes: ${paths.join(', ')}`);
  const principleReq = apiRequests.find((r) => r.path === '/api/v1/principles');
  if (principleReq.query.include_content !== 'true' || principleReq.query.locale !== 'es') fail(`pro principle request query: ${JSON.stringify(principleReq.query)}`);
  console.log(`smoke-test pro mode OK: body, prompts and audit from the API, ${apiRequests.length} requests, all with Bearer key and uxui-mcp UA`);
}

cleanup();
console.log('smoke-test PASSED');
