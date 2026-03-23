#!/usr/bin/env node
/**
 * Job Scraper — Hits Greenhouse, Ashby, Lever, SmartRecruiters public APIs daily.
 * Scrapes ALL roles (no industry filter). Matching is done client-side per user's resume.
 * Writes jobs to Firestore (shared collection) + static JSON backup.
 */
const fs = require('fs');
const path = require('path');

/* ─── Firebase Admin Setup ─── */
let firestoreDb = null;
async function initFirestore() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('  ⚠ No FIREBASE_SERVICE_ACCOUNT — skipping Firestore write');
    return;
  }
  try {
    const admin = require('firebase-admin');
    const cred = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(cred) });
    firestoreDb = admin.firestore();
    console.log('  ✓ Firestore connected');
  } catch (e) {
    console.error('  ✗ Firestore init failed:', e.message);
  }
}

async function writeJobsToFirestore(allJobs, newJobs) {
  if (!firestoreDb) return;
  try {
    const batch = firestoreDb.batch();
    // Write metadata
    batch.set(firestoreDb.doc('jobs/meta'), {
      lastScraped: new Date().toISOString(),
      totalJobs: allJobs.length,
      newJobsCount: newJobs.length,
      sources: SOURCES.length,
    });
    // Write jobs in chunks (Firestore batch limit = 500)
    const chunks = [];
    for (let i = 0; i < allJobs.length; i += 200) {
      chunks.push(allJobs.slice(i, i + 200));
    }
    // Store jobs as arrays in chunk docs (fewer writes than 1 doc per job)
    for (let i = 0; i < chunks.length; i++) {
      batch.set(firestoreDb.doc(`jobs/chunk_${i}`), {
        jobs: chunks[i],
        updatedAt: new Date().toISOString(),
      });
    }
    batch.set(firestoreDb.doc('jobs/chunks'), { count: chunks.length });
    await batch.commit();
    console.log(`  ✓ Wrote ${allJobs.length} jobs to Firestore (${chunks.length} chunks)`);
  } catch (e) {
    console.error('  ✗ Firestore write failed:', e.message);
  }
}

const SOURCES = [
  { type:'greenhouse', slug:'iherb', company:'iHerb' },
  { type:'greenhouse', slug:'coinbase', company:'Coinbase' },
  { type:'greenhouse', slug:'figma', company:'Figma' },
  { type:'greenhouse', slug:'stripe', company:'Stripe' },
  { type:'greenhouse', slug:'notion', company:'Notion' },
  { type:'greenhouse', slug:'airtable', company:'Airtable' },
  { type:'greenhouse', slug:'plaid', company:'Plaid' },
  { type:'greenhouse', slug:'brex', company:'Brex' },
  { type:'greenhouse', slug:'ramp', company:'Ramp' },
  { type:'greenhouse', slug:'openai', company:'OpenAI' },
  { type:'greenhouse', slug:'anthropic', company:'Anthropic' },
  { type:'greenhouse', slug:'databricks', company:'Databricks' },
  { type:'greenhouse', slug:'vercel', company:'Vercel' },
  { type:'greenhouse', slug:'linear', company:'Linear' },
  { type:'greenhouse', slug:'retool', company:'Retool' },
  { type:'greenhouse', slug:'webflow', company:'Webflow' },
  { type:'greenhouse', slug:'amplitude', company:'Amplitude' },
  { type:'greenhouse', slug:'gusto', company:'Gusto' },
  { type:'greenhouse', slug:'rippling', company:'Rippling' },
  { type:'greenhouse', slug:'duolingo', company:'Duolingo' },
  { type:'greenhouse', slug:'discord', company:'Discord' },
  { type:'greenhouse', slug:'canva', company:'Canva' },
  { type:'greenhouse', slug:'gitlab', company:'GitLab' },
  { type:'greenhouse', slug:'benchling', company:'Benchling' },
  { type:'greenhouse', slug:'reddit', company:'Reddit' },
  { type:'greenhouse', slug:'squarespace', company:'Squarespace' },
  { type:'ashby', slug:'jasper', company:'Jasper AI' },
  { type:'ashby', slug:'linear', company:'Linear' },
  { type:'ashby', slug:'vercel', company:'Vercel' },
  { type:'lever', slug:'Netflix', company:'Netflix' },
  { type:'lever', slug:'twitch', company:'Twitch' },
  { type:'lever', slug:'github', company:'GitHub' },
  { type:'smartrecruiters', slug:'Spotify', company:'Spotify' },
  { type:'smartrecruiters', slug:'Visa', company:'Visa' },
  { type:'smartrecruiters', slug:'BOSCH', company:'Bosch' },
];

const SALARY_RE = /\$\s*([\d,]+)\s*[k]?\s*[-–—to]+\s*\$?\s*([\d,]+)\s*[k]?/i;
const SALARY_RE2 = /([\d,]+)\s*-\s*([\d,]+)\s*(USD|per year|annually)/i;

function parseSalary(text) {
  if (!text) return null;
  let m = text.match(SALARY_RE);
  if (m) {
    let lo = parseInt(m[1].replace(/,/g,'')), hi = parseInt(m[2].replace(/,/g,''));
    if (lo < 1000) lo *= 1000; if (hi < 1000) hi *= 1000;
    return { min:lo, max:hi, display:`$${Math.round(lo/1000)}k–$${Math.round(hi/1000)}k` };
  }
  m = text.match(SALARY_RE2);
  if (m) {
    let lo = parseInt(m[1].replace(/,/g,'')), hi = parseInt(m[2].replace(/,/g,''));
    if (lo < 1000) lo *= 1000; if (hi < 1000) hi *= 1000;
    return { min:lo, max:hi, display:`$${Math.round(lo/1000)}k–$${Math.round(hi/1000)}k` };
  }
  return null;
}

async function fetchJSON(url) {
  try {
    const r = await fetch(url, { headers:{'User-Agent':'JobAgentApp/1.0'}, signal:AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { console.error(`  x ${url}: ${e.message}`); return null; }
}

async function scrapeGH(slug, co) {
  const d = await fetchJSON(`https://api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  if (!d?.jobs) return [];
  return d.jobs.map(j=>{
    const raw = (j.content||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return { id:`gh-${slug}-${j.id}`, title:j.title, company:co,
      location:j.location?.name||'Unknown', url:j.absolute_url,
      postedAt:j.updated_at||new Date().toISOString(), source:'greenhouse',
      description:raw.substring(0,3000), salary:parseSalary(raw) };
  });
}

async function scrapeAshby(slug, co) {
  const d = await fetchJSON(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (!d?.jobs) return [];
  return d.jobs.map(j=>{
    const raw = (j.descriptionPlain||j.description||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return { id:`ash-${slug}-${j.id}`, title:j.title, company:co,
      location:j.location||j.locationName||'Unknown', url:`https://jobs.ashbyhq.com/${slug}/${j.id}`,
      postedAt:j.publishedAt||j.createdAt||new Date().toISOString(), source:'ashby',
      description:raw.substring(0,3000), salary:parseSalary(raw) };
  });
}

async function scrapeLever(slug, co) {
  const d = await fetchJSON(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!Array.isArray(d)) return [];
  return d.map(j=>{
    const raw = (j.descriptionPlain||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return { id:`lev-${slug}-${j.id}`, title:j.text, company:co,
      location:j.categories?.location||'Unknown', url:j.hostedUrl||j.applyUrl,
      postedAt:j.createdAt?new Date(j.createdAt).toISOString():new Date().toISOString(), source:'lever',
      description:raw.substring(0,3000), salary:parseSalary(raw) };
  });
}

async function scrapeSmartRecruiters(slug, co) {
  const d = await fetchJSON(`https://api.smartrecruiters.com/v1/companies/${slug}/postings`);
  if (!d?.content) return [];
  return d.content.map(j => {
    const loc = j.location?.city ? `${j.location.city}, ${j.location.region||''} ${j.location.country||''}`.trim() : 'Unknown';
    const desc = (j.name || '') + ' ' + (j.customField?.map(f=>f.valueLabel).join(' ') || '');
    const comp = j.compensation;
    let salary = null;
    if (comp?.min && comp?.max) {
      salary = { min:comp.min, max:comp.max, display:`$${Math.round(comp.min/1000)}k–$${Math.round(comp.max/1000)}k` };
    }
    return { id:`sr-${slug}-${j.id}`, title:j.name, company:co,
      location:loc, url:j.ref||`https://jobs.smartrecruiters.com/${slug}/${j.id}`,
      postedAt:j.releasedDate||new Date().toISOString(), source:'smartrecruiters',
      description:desc.substring(0,3000), salary };
  });
}

function tagJob(j) {
  const t = (j.title||'').toLowerCase(), d = (j.description||'').toLowerCase(), tags = [];
  if (t.includes('director')||t.includes('head of')||t.includes('vp ')||t.includes('vice president')) tags.push('Director');
  if (t.includes('principal')||t.includes('staff')||t.includes('distinguished')) tags.push('Principal IC');
  if (t.includes('senior')||t.includes('sr.')) tags.push('Senior');
  if (t.includes('lead')) tags.push('Lead');
  if (t.includes('manager')) tags.push('Manager');
  if (t.includes('intern')||t.includes('internship')) tags.push('Intern');
  if (d.includes('ai')||d.includes('machine learning')||t.includes('ai')||t.includes('ml')) tags.push('AI/ML');
  if (t.includes('design')||t.includes('ux')||t.includes('ui')) tags.push('Design');
  if (t.includes('engineer')||t.includes('developer')||t.includes('swe')) tags.push('Engineering');
  if (t.includes('product manager')||t.includes('program manager')) tags.push('Product');
  if (t.includes('data')||t.includes('analyst')||t.includes('analytics')) tags.push('Data');
  if (t.includes('market')||t.includes('growth')) tags.push('Marketing');
  if (t.includes('sales')||t.includes('account')) tags.push('Sales');
  if (t.includes('ops')||t.includes('operations')) tags.push('Operations');
  if (d.includes('healthcare')||d.includes('hipaa')) tags.push('Healthcare');
  if (d.includes('fintech')||d.includes('financial')) tags.push('Fintech');
  if (tags.length===0) tags.push('IC');
  return tags;
}

async function main() {
  console.log('Job Agent App — Scraping', new Date().toISOString());
  await initFirestore();
  console.log(`Scanning ${SOURCES.length} companies...\n`);
  const allJobs = [];

  for (const src of SOURCES) {
    process.stdout.write(`  ${src.company} (${src.type})... `);
    let jobs = [];
    if (src.type==='greenhouse') jobs = await scrapeGH(src.slug, src.company);
    else if (src.type==='ashby') jobs = await scrapeAshby(src.slug, src.company);
    else if (src.type==='lever') jobs = await scrapeLever(src.slug, src.company);
    else if (src.type==='smartrecruiters') jobs = await scrapeSmartRecruiters(src.slug, src.company);
    jobs.forEach(j => { j.tags = tagJob(j); });
    console.log(`${jobs.length} jobs`);
    allJobs.push(...jobs);
  }

  // Detect new jobs
  const dataDir = path.join(__dirname, '..', 'data');
  const pubDir = path.join(__dirname, '..', 'public', 'data');
  const dataFile = path.join(dataDir, 'jobs.json');
  const newFile = path.join(dataDir, 'new-jobs.json');
  [dataDir, pubDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, {recursive:true}); });

  let prev = [];
  if (fs.existsSync(dataFile)) { try { prev = JSON.parse(fs.readFileSync(dataFile,'utf-8')).jobs||[]; } catch {} }
  const prevIds = new Set(prev.map(j=>j.id));
  const newJobs = allJobs.filter(j=>!prevIds.has(j.id));
  allJobs.sort((a,b)=>new Date(b.postedAt)-new Date(a.postedAt));

  // Write to Firestore
  await writeJobsToFirestore(allJobs, newJobs);

  // Write static JSON backup
  const output = { lastScraped:new Date().toISOString(), totalJobs:allJobs.length, newJobsCount:newJobs.length, sources:SOURCES.length, jobs:allJobs };
  const newOutput = { scrapedAt:new Date().toISOString(), count:newJobs.length, jobs:newJobs };
  fs.writeFileSync(dataFile, JSON.stringify(output, null, 2));
  fs.writeFileSync(newFile, JSON.stringify(newOutput, null, 2));
  fs.writeFileSync(path.join(pubDir, 'jobs.json'), JSON.stringify(output, null, 2));
  fs.writeFileSync(path.join(pubDir, 'new-jobs.json'), JSON.stringify(newOutput, null, 2));

  console.log(`\nDone! ${allJobs.length} jobs. ${newJobs.length} NEW.`);

  if (newJobs.length > 0) {
    console.log('\nNEW JOBS:');
    newJobs.forEach(j=>console.log(`  ${j.company} — ${j.title} (${j.location})\n    ${j.url}`));
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_jobs_count=${newJobs.length}\nhas_new_jobs=true\n`);
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      const s = newJobs.map(j=>`* **${j.company}** — ${j.title}\n  ${j.url}`).join('\n');
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ${newJobs.length} New Jobs\n\n${s}\n`);
    }
  } else if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_jobs_count=0\nhas_new_jobs=false\n`);
  }
}

main().catch(console.error);
