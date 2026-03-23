import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ResumeEngine from './ResumeEngine';
import AuthScreen from './AuthScreen';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { saveUserJobs, loadUserJobs, loadUserResume as loadUserResumeDB } from './firestore';

/* ─── Resume-aware helpers ─── */
function loadUserResumeLocal() {
  try {
    const d = JSON.parse(localStorage.getItem('jobagent_resume'));
    return d?.parsed || null;
  } catch { return null; }
}

function buildSmartSystem(resume) {
  if (!resume) return null;
  const c = resume.contact || {};
  const name = c.name || 'the applicant';
  const expYears = resume.experience?.length ? `${resume.experience.length}+ roles` : '';
  const metricsStr = (resume.metrics || []).join(', ');
  const skillsStr = (resume.skills || []).slice(0, 15).join(', ');
  const topRoles = (resume.experience || []).slice(0, 3).map(e => `${e.title} at ${e.company}`).join('; ');
  const contactInfo = [c.email, c.phone, c.location, c.linkedin, c.portfolio].filter(Boolean).join(' | ');
  return `You write cover letters for ${name}. Background: ${expYears}. Recent roles: ${topRoles}. Key metrics: ${metricsStr}. Skills: ${skillsStr}. Contact: ${contactInfo}. Write 3 paragraphs. Lead with metrics that map to the role. Confident, human tone. Include portfolio+contact in closing. Return ONLY the letter.`;
}

function buildSmartFields(resume) {
  if (!resume?.contact) return [];
  const c = resume.contact;
  return [
    { l: "Full Name", v: c.name || '' },
    { l: "Email", v: c.email || '' },
    { l: "Phone", v: c.phone || '' },
    { l: "Location", v: c.location || '' },
    { l: "LinkedIn", v: c.linkedin || '' },
    { l: "Portfolio", v: c.portfolio || '' },
  ].filter(f => f.v);
}

/* ─── Match Score Engine (client-side, no API) ─── */
function computeMatchScore(job, resume) {
  if (!resume) return null;
  let score = 0;
  let maxScore = 0;
  const jobText = `${job.title} ${job.company} ${(job.tags||[]).join(' ')} ${job.description || ''}`.toLowerCase();

  // Skill matches (40 points max)
  const skills = (resume.skills || []).map(s => s.toLowerCase());
  if (skills.length > 0) {
    maxScore += 40;
    const matched = skills.filter(s => jobText.includes(s)).length;
    score += Math.min(40, Math.round((matched / Math.min(skills.length, 10)) * 40));
  }

  // Title/seniority alignment (30 points max)
  maxScore += 30;
  const resumeTitles = (resume.experience || []).map(e => e.title?.toLowerCase() || '');
  const titleKeywords = new Set();
  resumeTitles.forEach(t => t.split(/[\s,/]+/).forEach(w => { if (w.length > 3) titleKeywords.add(w); }));
  const titleMatched = [...titleKeywords].filter(k => jobText.includes(k)).length;
  score += Math.min(30, Math.round((titleMatched / Math.max(titleKeywords.size, 1)) * 30));

  // Tag matches (20 points max)
  const jobTags = (job.tags || []).map(t => t.toLowerCase());
  if (jobTags.length > 0) {
    maxScore += 20;
    const resumeText = `${resumeTitles.join(' ')} ${skills.join(' ')}`;
    const tagHits = jobTags.filter(t => resumeText.includes(t.toLowerCase())).length;
    score += Math.round((tagHits / jobTags.length) * 20);
  }

  // Freshness bonus (10 points max)
  maxScore += 10;
  const days = daysAgo(job.postedAt);
  if (days <= 3) score += 10;
  else if (days <= 7) score += 7;
  else if (days <= 14) score += 4;

  return maxScore > 0 ? Math.min(99, Math.round((score / maxScore) * 100)) : null;
}

/* ─── Steel Studio Design Tokens ─── */
const T = {
  bg:       '#0B1F22',
  surface:  '#0F2A2E',
  surfaceH: '#143438',
  border:   '#1C4347',
  borderL:  '#245357',
  mint:     '#3ECDA0',
  mintDim:  '#2A8F70',
  mintBg:   'rgba(62,205,160,0.08)',
  teal:     '#2DB28A',
  gold:     '#D4C44C',
  goldDim:  '#A89A3A',
  goldBg:   'rgba(212,196,76,0.10)',
  white:    '#E8ECE9',
  light:    '#A3B5B0',
  muted:    '#6B8580',
  dim:      '#4A635E',
  error:    '#E85D5D',
  errorBg:  'rgba(232,93,93,0.10)',
  fresh:    '#3ECDA0',   // 0-3 days
  aging:    '#D4C44C',   // 4-14 days
  stale:    '#E85D5D',   // 15+ days
  font:     "'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  radius:   10,
  radiusLg: 14,
  radiusPill: 20,
};

/* ─── Persistence (Firestore-backed, localStorage fallback) ─── */

/* ─── Age helpers ─── */
function daysAgo(d) {
  if (!d) return 999;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}
function agoLabel(d) {
  const days = daysAgo(d);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  return Math.floor(days / 30) + 'mo ago';
}
function ageColor(d) {
  const days = daysAgo(d);
  if (days <= 3) return T.fresh;
  if (days <= 14) return T.aging;
  return T.stale;
}

/* ─── Pill Button ─── */
function Btn({ children, onClick, href, primary, green, small, disabled }) {
  const base = { padding:small?'4px 12px':'8px 20px', borderRadius:T.radiusPill, fontWeight:500,
    fontSize:small?11:13, cursor:disabled?'wait':'pointer', fontFamily:T.font,
    textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6,
    transition:'all 0.15s ease', letterSpacing:0.2, opacity:disabled?0.5:1 };
  const styles = primary
    ? { ...base, background:T.mint, color:'#0B1F22', border:'none' }
    : green
    ? { ...base, background:T.teal, color:'#fff', border:'none' }
    : { ...base, background:'transparent', color:T.light, border:`1px solid ${T.border}` };
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={styles}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} style={styles}>{children}</button>;
}

/* ─── Job Card with collapsible description ─── */
function JobCard({ job, expanded, onToggle, onGen, onView, onApplied, matchScore, hasResume, onGoResume }) {
  const [jd, setJd] = useState('');
  const [showDesc, setShowDesc] = useState(false);
  const sm = {
    new:        { bg:T.goldBg,  c:T.gold,  l:'NEW' },
    ready:      { bg:T.mintBg,  c:T.mintDim, l:'Ready' },
    generating: { bg:'rgba(62,205,160,0.15)', c:T.mint, l:'Generating…' },
    drafted:    { bg:T.mintBg,  c:T.mint,  l:'Drafted' },
    applied:    { bg:T.mintBg,  c:T.mint,  l:'Applied ✓' },
  };
  const st = sm[job._s||'ready']||sm.ready;
  const accent = job._new ? T.gold : job._s==='applied' ? T.mint : T.border;
  const ageDays = daysAgo(job.postedAt);
  const ageC = ageColor(job.postedAt);

  return (
    <div onClick={onToggle} style={{ background:T.surface, border:`1px solid ${T.border}`,
      borderRadius:T.radius, padding:'16px 20px', marginBottom:8, cursor:'pointer',
      borderTop:`2px solid ${accent}`, transition:'background 0.15s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between' }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
            <span style={{ fontSize:16, fontWeight:500, color:T.white, letterSpacing:-0.2 }}>{job.company}</span>
            <span style={{ fontSize:10, padding:'2px 10px', borderRadius:T.radiusPill, background:st.bg, color:st.c, fontWeight:500, letterSpacing:0.4 }}>{st.l}</span>
            {job._new && <span style={{ fontSize:10, padding:'2px 10px', borderRadius:T.radiusPill, background:T.goldBg, color:T.gold, fontWeight:500 }}>● NEW</span>}
            {matchScore != null && <span style={{ fontSize:10, padding:'2px 10px', borderRadius:T.radiusPill,
              background: matchScore >= 70 ? T.mintBg : matchScore >= 40 ? T.goldBg : T.errorBg,
              color: matchScore >= 70 ? T.mint : matchScore >= 40 ? T.gold : T.error,
              fontWeight:600, letterSpacing:0.3 }}>{matchScore}% match</span>}
          </div>
          <div style={{ fontSize:14, color:T.light, fontWeight:400, marginBottom:6 }}>{job.title}</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:12, color:T.muted }}>{job.location}</span>
            <span style={{ fontSize:12, color:T.dim }}>·</span>
            {/* Age-colored posted date */}
            <span style={{ fontSize:12, color:ageC, fontWeight:ageDays<=3?500:400 }}>
              {ageDays<=3?'🟢':''}  {agoLabel(job.postedAt)}
            </span>
            <span style={{ fontSize:10, color:T.dim }}>({job.source})</span>
            {/* Salary badge */}
            {job.salary && <span style={{ fontSize:10, padding:'1px 8px', borderRadius:T.radiusPill,
              background:T.mintBg, color:T.mint, fontWeight:500 }}>{job.salary.display}</span>}
            {(job.tags||[]).map(t=><span key={t} style={{ fontSize:10, padding:'1px 8px', borderRadius:T.radiusPill,
              border:`1px solid ${T.border}`, color:T.mintDim, fontWeight:500 }}>{t}</span>)}
          </div>
        </div>
      </div>

      {/* Expanded section with description accordion + actions */}
      {expanded && (
        <div style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${T.border}` }} onClick={e=>e.stopPropagation()}>

          {/* Collapsible job description */}
          {job.description && (
            <div style={{ marginBottom:12 }}>
              <button onClick={()=>setShowDesc(!showDesc)}
                style={{ background:'none', border:'none', color:T.mint, fontSize:12, fontWeight:500,
                  cursor:'pointer', fontFamily:T.font, padding:0, marginBottom:showDesc?8:0,
                  display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ transform:showDesc?'rotate(90deg)':'rotate(0)', transition:'transform 0.15s', display:'inline-block' }}>▸</span>
                {showDesc ? 'Hide Description' : 'View Job Description'}
              </button>
              {showDesc && (
                <div style={{ fontSize:12, color:T.light, lineHeight:1.7, background:T.bg,
                  padding:14, borderRadius:T.radius, border:`1px solid ${T.border}`,
                  maxHeight:250, overflowY:'auto', whiteSpace:'pre-wrap' }}>
                  {job.description}
                </div>
              )}
            </div>
          )}

          {/* Optional paste override for custom JD */}
          <details style={{ marginBottom:12 }}>
            <summary style={{ fontSize:11, color:T.dim, cursor:'pointer', fontFamily:T.font, fontWeight:400 }}>
              Paste custom job description (optional)
            </summary>
            <textarea value={jd} onChange={e=>setJd(e.target.value)} placeholder="Paste full JD for more tailored cover letter…"
              style={{ width:'100%', minHeight:70, padding:10, borderRadius:T.radius, border:`1px solid ${T.border}`,
                background:T.bg, color:T.white, fontSize:12, fontFamily:T.font, fontWeight:300,
                resize:'vertical', outline:'none', marginTop:6 }} />
          </details>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {hasResume ? (
              <Btn primary onClick={()=>onGen(job, jd || job.description)} disabled={job._s==='generating'}>
                {job._s==='generating'?'Generating…':'Generate Cover Letter'}
              </Btn>
            ) : (
              <Btn onClick={onGoResume} style={{ borderColor:T.gold, color:T.gold }}>
                Upload Resume to Generate Letters
              </Btn>
            )}
            {job._cl && <Btn onClick={()=>onView(job)}>View Letter</Btn>}
            <Btn href={job.url}>Open Posting ↗</Btn>
            {job._cl && job._s!=='applied' && <Btn green onClick={()=>onApplied(job.id)}>Mark Applied ✓</Btn>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Cover Letter Modal ─── */
function Modal({ job, onClose }) {
  if (!job) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(5,15,17,0.85)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.radiusLg,
        padding:28, maxWidth:680, width:'100%', maxHeight:'80vh', overflow:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:500, color:T.white, fontFamily:T.font }}>Cover Letter — {job.company}</h2>
            <p style={{ margin:'2px 0 0', fontSize:12, color:T.muted }}>{job.title}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:T.muted, fontWeight:300 }}>×</button>
        </div>
        <pre style={{ whiteSpace:'pre-wrap', fontFamily:T.font, fontSize:13, fontWeight:300,
          lineHeight:1.8, color:T.white, background:T.bg, padding:20, borderRadius:T.radius,
          border:`1px solid ${T.border}` }}>{job._cl}</pre>
        <div style={{ marginTop:14 }}>
          <Btn primary onClick={()=>navigator.clipboard.writeText(job._cl)}>Copy to Clipboard</Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ─── */
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in
  const [allJobs, setAllJobs] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(null);
  const [showFill, setShowFill] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all'); // P1-2: age filter
  const [search, setSearch] = useState('');
  const [page, setPage] = useState('jobs'); // 'jobs' | 'resume'
  const [userResume, setUserResume] = useState(null);

  /* Auth listener */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return unsub;
  }, []);

  /* Load user resume from Firestore (falls back to localStorage) */
  useEffect(() => {
    async function loadResume() {
      if (!user) return;
      try {
        const dbResume = await loadUserResumeDB(user.uid);
        if (dbResume?.parsed) {
          setUserResume(dbResume.parsed);
          return;
        }
      } catch {}
      // Fallback to localStorage for migration
      setUserResume(loadUserResumeLocal());
    }
    loadResume();
  }, [user, page]);

  const smartFields = useMemo(() => buildSmartFields(userResume), [userResume]);
  const hasResume = !!userResume;

  /* Load jobs + merge persisted state from Firestore */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${process.env.PUBLIC_URL || ''}/data/jobs.json`);
        const data = await res.json();
        let newIds = new Set();
        try {
          const nr = await fetch(`${process.env.PUBLIC_URL || ''}/data/new-jobs.json`);
          const nd = await nr.json();
          newIds = new Set((nd.jobs || []).map(j => j.id));
        } catch {}
        // Load persisted states from Firestore
        let persisted = {};
        if (user) {
          try { persisted = await loadUserJobs(user.uid); } catch {}
        }
        setAllJobs((data.jobs || []).map(j => {
          const p = persisted[j.id] || {};
          return { ...j, _s: p._s || 'ready', _cl: p._cl || '', _new: newIds.has(j.id) };
        }));
        setMeta({ lastScraped:data.lastScraped, totalJobs:data.totalJobs, newJobsCount:data.newJobsCount });
      } catch { setAllJobs([]); }
      setLoading(false);
    }
    if (user) load();
  }, [user]);

  /* Persist state changes to Firestore */
  const persistJobs = useCallback((jobs) => {
    if (!user) return;
    const state = {};
    jobs.forEach(j => { if (j._s !== 'ready' || j._cl) state[j.id] = { _s: j._s, _cl: j._cl }; });
    saveUserJobs(user.uid, state).catch(() => {});
  }, [user]);
  useEffect(() => { if (allJobs.length > 0) persistJobs(allJobs); }, [allJobs, persistJobs]);

  const companies = useMemo(() => ['all', ...new Set(allJobs.map(j => j.company))], [allJobs]);
  const tags = useMemo(() => ['all', ...new Set(allJobs.flatMap(j => j.tags || []))], [allJobs]);

  const filtered = useMemo(() => {
    return allJobs
      .map(j => ({ ...j, _match: computeMatchScore(j, userResume) }))
      .filter(j => statusFilter === 'all' || j._s === statusFilter || (statusFilter === 'new' && j._new))
      .filter(j => companyFilter === 'all' || j.company === companyFilter)
      .filter(j => tagFilter === 'all' || (j.tags || []).includes(tagFilter))
      .filter(j => {
        if (ageFilter === 'all') return true;
        const d = daysAgo(j.postedAt);
        if (ageFilter === '7') return d <= 7;
        if (ageFilter === '14') return d <= 14;
        if (ageFilter === '30') return d <= 30;
        return true;
      })
      .filter(j => !search || `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'match') return (b._match || 0) - (a._match || 0);
        if (sortBy === 'newest') return new Date(b.postedAt) - new Date(a.postedAt);
        if (sortBy === 'oldest') return new Date(a.postedAt) - new Date(b.postedAt);
        if (sortBy === 'company') return a.company.localeCompare(b.company);
        return 0;
      });
  }, [allJobs, userResume, statusFilter, companyFilter, tagFilter, ageFilter, search, sortBy]);

  const stats = useMemo(() => ({
    total: allJobs.length, new_count: allJobs.filter(j => j._new).length,
    drafted: allJobs.filter(j => j._s === 'drafted').length,
    applied: allJobs.filter(j => j._s === 'applied').length,
  }), [allJobs]);

  const genLetter = async (job, jd) => {
    const sys = buildSmartSystem(userResume);
    if (!sys) return; // no resume uploaded — can't generate
    setAllJobs(p => p.map(j => j.id===job.id ? {...j,_s:'generating'} : j));
    try {
      const desc = jd || job.description || '';
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, system:sys,
          messages:[{role:'user',content:`Cover letter for:\nCompany: ${job.company}\nRole: ${job.title}\nLocation: ${job.location}\nTags: ${(job.tags||[]).join(', ')}\n${job.salary?`Salary: ${job.salary.display}\n`:''}\nJob Description:\n${desc}`}] }),
      });
      const d = await r.json();
      const letter = d.content?.map(c=>c.text||'').join('')||'Error';
      setAllJobs(p => p.map(j => j.id===job.id ? {...j,_cl:letter,_s:'drafted'} : j));
    } catch { setAllJobs(p => p.map(j => j.id===job.id ? {...j,_s:'ready'} : j)); }
  };

  const markApplied = (id) => setAllJobs(p => p.map(j => j.id===id ? {...j,_s:'applied'} : j));
  const resetAll = () => { if (user) saveUserJobs(user.uid, {}).catch(()=>{}); window.location.reload(); };
  const hasFilters = companyFilter!=='all'||tagFilter!=='all'||statusFilter!=='all'||ageFilter!=='all'||search;
  const clear = () => { setCompanyFilter('all'); setTagFilter('all'); setStatusFilter('all'); setAgeFilter('all'); setSearch(''); setSortBy('newest'); };

  const sel = { padding:'6px 12px', borderRadius:T.radius, border:`1px solid ${T.border}`,
    background:T.bg, color:T.white, fontSize:12, fontFamily:T.font, fontWeight:400,
    cursor:'pointer', outline:'none', WebkitAppearance:'none' };

  // Auth loading state
  if (user === undefined) {
    return <div style={{ background:T.bg, minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', color:T.muted, fontFamily:T.font }}>Loading…</div>;
  }

  // Not logged in
  if (!user) return <AuthScreen />;

  return (
    <div style={{ background:T.bg, minHeight:'100vh', color:T.white, fontFamily:T.font, fontWeight:400 }}>

      {/* ─── Nav Bar ─── */}
      <div style={{ background:T.surface, borderBottom:`2px solid ${T.mint}`, padding:'14px 20px',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ maxWidth:880, width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:T.mint, boxShadow:`0 0 8px ${T.mint}` }} />
            <span style={{ fontSize:13, fontWeight:500, color:T.white, letterSpacing:0.3 }}>Job Agent</span>
            <div style={{ display:'flex', gap:2, marginLeft:12, background:T.bg, borderRadius:T.radiusPill, padding:2 }}>
              {[['jobs','Jobs'],['resume','Resume']].map(([k,l])=>(
                <button key={k} onClick={()=>setPage(k)} style={{ padding:'5px 16px', borderRadius:T.radiusPill,
                  border:'none', background:page===k?T.mint:'transparent', color:page===k?'#0B1F22':T.muted,
                  fontWeight:500, fontSize:11, cursor:'pointer', fontFamily:T.font, transition:'all 0.15s ease' }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:11, fontWeight:400, color:T.muted }}>
              {meta.lastScraped ? `Last scan: ${new Date(meta.lastScraped).toLocaleDateString()}` : 'Scanning…'}
            </span>
            <button onClick={resetAll} style={{ background:'none', border:'none', fontSize:10, color:T.dim, cursor:'pointer', fontFamily:T.font }}>Reset</button>
            <button onClick={() => signOut(auth)} style={{ background:'none', border:`1px solid ${T.border}`,
              borderRadius:T.radiusPill, padding:'4px 12px', fontSize:10, color:T.muted, cursor:'pointer', fontFamily:T.font }}>Sign Out</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:880, margin:'0 auto', padding:'24px 20px' }}>

      {/* ─── Resume Page ─── */}
      {page === 'resume' && (
        <div>
          <div style={{ marginBottom:24 }}>
            <h1 style={{ fontSize:30, fontWeight:300, margin:'0 0 4px', letterSpacing:-0.5, color:T.white }}>Resume Engine</h1>
            <p style={{ fontSize:14, color:T.muted, margin:0, fontWeight:400 }}>
              Upload, parse, assess & rewrite — powered by Claude AI
            </p>
          </div>
          <ResumeEngine userId={user.uid} />
        </div>
      )}

      {/* ─── Jobs Page ─── */}
      {page === 'jobs' && (<div>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:30, fontWeight:300, margin:'0 0 4px', letterSpacing:-0.5, color:T.white }}>Job Application Agent</h1>
          <p style={{ fontSize:14, color:T.muted, margin:0, fontWeight:400 }}>
            {hasResume ? `${companies.length-1} companies · AI cover letters · Application tracking` : 'Upload your resume to get started'}
          </p>
        </div>

        {/* ─── No Resume: Onboarding Gate ─── */}
        {!hasResume ? (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:56, marginBottom:20, opacity:0.7 }}>📄</div>
            <h2 style={{ fontSize:22, fontWeight:400, color:T.white, margin:'0 0 10px', fontFamily:T.font }}>
              Upload your resume to unlock job matching
            </h2>
            <p style={{ fontSize:14, color:T.muted, margin:'0 0 28px', lineHeight:1.7, maxWidth:440, marginLeft:'auto', marginRight:'auto' }}>
              We'll parse your skills and experience, then match you with relevant roles, generate personalized cover letters, and track your applications.
            </p>
            <button onClick={() => setPage('resume')}
              style={{ padding:'12px 32px', borderRadius:T.radiusPill, border:'none',
                background:T.mint, color:'#0B1F22', fontSize:15, fontWeight:600,
                cursor:'pointer', fontFamily:T.font, transition:'opacity 0.15s' }}>
              Upload Resume →
            </button>
            <div style={{ marginTop:40, display:'flex', justifyContent:'center', gap:32 }}>
              {[
                { icon:'🎯', title:'Job Matching', desc:'Match scores based on your skills' },
                { icon:'✉️', title:'Cover Letters', desc:'AI-generated from your resume' },
                { icon:'📊', title:'Track Progress', desc:'Ready → Drafted → Applied' },
              ].map(f => (
                <div key={f.title} style={{ textAlign:'center', maxWidth:160 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{f.icon}</div>
                  <div style={{ fontSize:13, fontWeight:500, color:T.white, marginBottom:4 }}>{f.title}</div>
                  <div style={{ fontSize:11, color:T.muted }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
        <div>


        {/* ─── Status Tiles ─── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:22 }}>
          {[
            { l:'Total',   v:stats.total,     c:T.mint },
            { l:'New',     v:stats.new_count,  c:T.gold },
            { l:'Drafted', v:stats.drafted,    c:T.light },
            { l:'Applied', v:stats.applied,    c:T.mint },
          ].map(s=>(
            <div key={s.l} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.radius,
              padding:'18px 16px', textAlign:'center' }}>
              <div style={{ fontSize:36, fontWeight:300, color:s.c, lineHeight:1, fontFamily:T.font }}>{s.v}</div>
              <div style={{ fontSize:11, color:T.muted, fontWeight:500, textTransform:'uppercase',
                letterSpacing:1.2, marginTop:6 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ─── Search Field ─── */}
        <div style={{ position:'relative', marginBottom:14 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search for a role or company…"
            style={{ width:'100%', padding:'11px 40px 11px 16px', borderRadius:T.radius,
              border:`1px solid ${T.border}`, background:T.surface, color:T.white,
              fontSize:14, fontFamily:T.font, fontWeight:300, outline:'none' }} />
          <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
            fontSize:16, color:T.muted, pointerEvents:'none' }}>⌕</span>
        </div>


        {/* ─── Status Pills ─── */}
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          {[['all','All'],['new','● New'],['ready','Ready'],['drafted','Drafted'],['applied','Applied']].map(([k,label])=>(
            <button key={k} onClick={()=>setStatusFilter(k)}
              style={{ padding:'5px 16px', borderRadius:T.radiusPill,
                border:`1px solid ${statusFilter===k ? T.mint : T.border}`,
                background:statusFilter===k ? T.mint : 'transparent',
                color:statusFilter===k ? '#0B1F22' : T.light,
                fontWeight:500, fontSize:12, cursor:'pointer', fontFamily:T.font,
                transition:'all 0.15s ease' }}>{label}</button>
          ))}
          <div style={{ flex:1 }} />
          {hasResume && <button onClick={()=>setShowFill(!showFill)}
            style={{ padding:'5px 16px', borderRadius:T.radiusPill,
              border:`1px solid ${showFill ? T.mint : T.border}`,
              background:showFill ? T.mintBg : 'transparent',
              color:showFill ? T.mint : T.light,
              fontWeight:500, fontSize:12, cursor:'pointer', fontFamily:T.font }}>
            {showFill?'Hide':'Show'} Quick-Fill</button>}
        </div>


        {/* ─── Sort + Filters (with age filter) ─── */}
        <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
          <label style={{ fontSize:10, fontWeight:500, color:T.muted, textTransform:'uppercase', letterSpacing:0.8 }}>Sort:</label>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={sel}>
            {hasResume && <option value="match">Best Match</option>}
            <option value="newest">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="company">Company A–Z</option>
          </select>
          <label style={{ fontSize:10, fontWeight:500, color:T.muted, textTransform:'uppercase', letterSpacing:0.8, marginLeft:8 }}>Company:</label>
          <select value={companyFilter} onChange={e=>setCompanyFilter(e.target.value)} style={sel}>
            {companies.map(c=><option key={c} value={c}>{c==='all'?'All':c}</option>)}
          </select>
          <label style={{ fontSize:10, fontWeight:500, color:T.muted, textTransform:'uppercase', letterSpacing:0.8, marginLeft:8 }}>Tag:</label>
          <select value={tagFilter} onChange={e=>setTagFilter(e.target.value)} style={sel}>
            {tags.map(t=><option key={t} value={t}>{t==='all'?'All':t}</option>)}
          </select>
          <label style={{ fontSize:10, fontWeight:500, color:T.muted, textTransform:'uppercase', letterSpacing:0.8, marginLeft:8 }}>Posted:</label>
          <select value={ageFilter} onChange={e=>setAgeFilter(e.target.value)} style={sel}>
            <option value="all">Any time</option>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
          </select>
          {hasFilters && <button onClick={clear} style={{ padding:'4px 12px', borderRadius:T.radiusPill, border:'none',
            background:T.errorBg, color:T.error, fontWeight:500, fontSize:11, cursor:'pointer', fontFamily:T.font }}>Clear</button>}
          <span style={{ fontSize:11, color:T.muted, marginLeft:'auto' }}>{filtered.length} of {allJobs.length}</span>
        </div>


        {/* ─── Quick-Fill ─── */}
        {showFill && smartFields.length > 0 && (
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.radius, padding:16, marginBottom:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {smartFields.map(f=>(
                <div key={f.l} onClick={()=>navigator.clipboard.writeText(f.v)}
                  style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`,
                    background:T.bg, cursor:'pointer', transition:'border-color 0.15s ease' }}>
                  <div style={{ fontSize:9, fontWeight:500, color:T.muted, textTransform:'uppercase', letterSpacing:0.8 }}>{f.l}</div>
                  <div style={{ fontSize:13, color:T.mint, marginTop:2, fontWeight:400 }}>{f.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Job Cards ─── */}
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:T.muted, fontWeight:300, fontSize:14 }}>Loading jobs…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:T.muted, fontWeight:300, fontSize:14 }}>
            {allJobs.length===0 ? 'No jobs scraped yet. Run npm run scrape or trigger the GitHub Action.' : 'No jobs match your filters.'}
          </div>
        ) : (
          filtered.map(job=>(
            <JobCard key={job.id} job={job} expanded={expanded===job.id}
              matchScore={job._match} hasResume={hasResume} onGoResume={() => setPage('resume')}
              onToggle={()=>setExpanded(expanded===job.id?null:job.id)}
              onGen={genLetter} onView={setModal} onApplied={markApplied} />
          ))
        )}

        )}
      </div>
      )}

      </div>)}

        {/* ─── Footer ─── */}
        <div style={{ textAlign:'center', padding:'32px 0 12px', fontSize:11, color:T.dim, fontWeight:400 }}>
          Job Agent · Scans Greenhouse, Ashby & Lever daily · Powered by Claude AI
        </div>
      </div>
      <Modal job={modal} onClose={()=>setModal(null)} />
    </div>
  );
}
