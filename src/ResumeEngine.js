import React, { useState, useEffect, useCallback, useRef } from 'react';
import { saveUserResume as saveUserResumeDB, loadUserResume as loadUserResumeDB } from './firestore';

/* ─── Design Tokens (shared with App.js) ─── */
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
  font:     "'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  radius:   10,
  radiusLg: 14,
  radiusPill: 20,
};

/* ─── localStorage persistence ─── */
const RESUME_KEY = 'jobagent_resume';
function loadResume() {
  try { return JSON.parse(localStorage.getItem(RESUME_KEY)) || null; } catch { return null; }
}
function saveResume(data) {
  try { localStorage.setItem(RESUME_KEY, JSON.stringify(data)); } catch {}
}

/* ─── Pill Button ─── */
function Btn({ children, onClick, primary, danger, small, disabled, style: sx }) {
  const base = { padding:small?'4px 12px':'8px 20px', borderRadius:T.radiusPill, fontWeight:500,
    fontSize:small?11:13, cursor:disabled?'wait':'pointer', fontFamily:T.font,
    textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6,
    transition:'all 0.15s ease', letterSpacing:0.2, opacity:disabled?0.5:1, border:'none' };
  const styles = primary
    ? { ...base, background:T.mint, color:'#0B1F22' }
    : danger
    ? { ...base, background:T.errorBg, color:T.error, border:`1px solid ${T.error}` }
    : { ...base, background:'transparent', color:T.light, border:`1px solid ${T.border}` };
  return <button onClick={onClick} disabled={disabled} style={{...styles, ...sx}}>{children}</button>;
}

/* ─── Section Header ─── */
function Section({ title, subtitle, children, action }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, fontWeight:500, color:T.white, fontFamily:T.font }}>{title}</h2>
          {subtitle && <p style={{ margin:'2px 0 0', fontSize:12, color:T.muted }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ─── Score Ring ─── */
function ScoreRing({ score, size = 80 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? T.mint : score >= 60 ? T.gold : T.error;
  return (
    <div style={{ position:'relative', width:size, height:size }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:22, fontWeight:300, color, fontFamily:T.font }}>{score}</span>
        <span style={{ fontSize:8, fontWeight:500, color:T.muted, textTransform:'uppercase', letterSpacing:1 }}>Score</span>
      </div>
    </div>
  );
}

/* ─── Assessment Card ─── */
function IssueCard({ issue }) {
  const sev = {
    critical: { bg:T.errorBg, border:T.error, color:T.error, label:'Critical' },
    warning:  { bg:T.goldBg, border:T.gold, color:T.gold, label:'Warning' },
    tip:      { bg:T.mintBg, border:T.mintDim, color:T.mint, label:'Tip' },
  };
  const s = sev[issue.severity] || sev.tip;
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderLeft:`3px solid ${s.border}`,
      borderRadius:T.radius, padding:'14px 16px', marginBottom:8 }}>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <span style={{ fontSize:9, padding:'2px 8px', borderRadius:T.radiusPill, background:s.bg,
            color:s.color, fontWeight:600, textTransform:'uppercase', letterSpacing:0.6 }}>{s.label}</span>
          <span style={{ fontSize:10, color:T.muted }}>{issue.category}</span>
        </div>
        <div style={{ fontSize:13, color:T.white, fontWeight:400, marginBottom:4 }}>{issue.title}</div>
        <div style={{ fontSize:12, color:T.light, lineHeight:1.6 }}>{issue.description}</div>
        {issue.fix && (
          <div style={{ fontSize:12, color:T.mint, marginTop:6, padding:'8px 12px',
            background:T.mintBg, borderRadius:8, lineHeight:1.6 }}>
            <strong>Suggested fix:</strong> {issue.fix}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Parsed Resume Display ─── */
function ResumeDisplay({ data }) {
  if (!data) return null;
  const { contact, summary, experience, skills, education, metrics } = data;
  const labelStyle = { fontSize:9, fontWeight:600, color:T.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:6 };
  const cardStyle = { background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.radius, padding:'14px 16px', marginBottom:8 };

  return (
    <div>
      {contact && (
        <div style={cardStyle}>
          <div style={labelStyle}>Contact</div>
          <div style={{ fontSize:15, fontWeight:500, color:T.white, marginBottom:4 }}>{contact.name}</div>
          <div style={{ fontSize:12, color:T.light, lineHeight:1.8 }}>
            {[contact.email, contact.phone, contact.location, contact.linkedin, contact.portfolio]
              .filter(Boolean).join(' · ')}
          </div>
        </div>
      )}
      {summary && (
        <div style={cardStyle}>
          <div style={labelStyle}>Summary</div>
          <div style={{ fontSize:13, color:T.light, lineHeight:1.7 }}>{summary}</div>
        </div>
      )}
      {metrics && metrics.length > 0 && (
        <div style={cardStyle}>
          <div style={labelStyle}>Key Metrics Extracted</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {metrics.map((m, i) => (
              <span key={i} style={{ fontSize:11, padding:'4px 12px', borderRadius:T.radiusPill,
                background:T.mintBg, color:T.mint, fontWeight:500 }}>{m}</span>
            ))}
          </div>
        </div>
      )}
      {experience && experience.length > 0 && (
        <div style={{ marginBottom:8 }}>
          <div style={labelStyle}>Experience ({experience.length} roles)</div>
          {experience.map((exp, i) => (
            <div key={i} style={{ ...cardStyle, borderLeft:`2px solid ${i === 0 ? T.mint : T.border}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <div>
                  <span style={{ fontSize:14, fontWeight:500, color:T.white }}>{exp.title}</span>
                  <span style={{ fontSize:12, color:T.muted, marginLeft:8 }}>@ {exp.company}</span>
                </div>
                <span style={{ fontSize:11, color:T.dim, whiteSpace:'nowrap' }}>{exp.dates}</span>
              </div>
              {exp.highlights && exp.highlights.length > 0 && (
                <div style={{ marginTop:6 }}>
                  {exp.highlights.map((h, j) => (
                    <div key={j} style={{ fontSize:12, color:T.light, lineHeight:1.7, paddingLeft:12,
                      borderLeft:`1px solid ${T.border}`, marginBottom:4 }}>{h}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {skills && skills.length > 0 && (
        <div style={cardStyle}>
          <div style={labelStyle}>Skills</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {skills.map((s, i) => (
              <span key={i} style={{ fontSize:11, padding:'3px 10px', borderRadius:T.radiusPill,
                border:`1px solid ${T.border}`, color:T.light, fontWeight:400 }}>{s}</span>
            ))}
          </div>
        </div>
      )}
      {education && education.length > 0 && (
        <div style={cardStyle}>
          <div style={labelStyle}>Education</div>
          {education.map((ed, i) => (
            <div key={i} style={{ fontSize:12, color:T.light, marginBottom:4 }}>
              <span style={{ fontWeight:500, color:T.white }}>{ed.degree}</span>
              {ed.school && <span style={{ color:T.muted }}> — {ed.school}</span>}
              {ed.year && <span style={{ color:T.dim }}> ({ed.year})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Resume Engine ─── */
export default function ResumeEngine({ userId }) {
  const [resumeData, setResumeData] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [dragOver, setDragOver] = useState(false);
  const [showLinkedIn, setShowLinkedIn] = useState(false);
  const fileRef = useRef();
  const linkedInRef = useRef();

  useEffect(() => {
    async function load() {
      // Try Firestore first
      if (userId) {
        try {
          const saved = await loadUserResumeDB(userId);
          if (saved) {
            setResumeData(saved.parsed || null);
            setAssessment(saved.assessment || null);
            setRawText(saved.rawText || '');
            setFileName(saved.fileName || '');
            setRewriteResult(saved.rewrite || null);
            setActiveTab(saved.parsed ? 'parsed' : 'upload');
            return;
          }
        } catch {}
      }
      // Fallback to localStorage for migration
      const local = loadResume();
      if (local) {
        setResumeData(local.parsed || null);
        setAssessment(local.assessment || null);
        setRawText(local.rawText || '');
        setFileName(local.fileName || '');
        setRewriteResult(local.rewrite || null);
        setActiveTab(local.parsed ? 'parsed' : 'upload');
      }
    }
    load();
  }, [userId]);

  const persist = useCallback((parsed, assess, raw, name, rewrite) => {
    const data = { parsed, assessment: assess, rawText: raw, fileName: name, rewrite };
    saveResume(data); // localStorage backup
    if (userId) saveUserResumeDB(userId, data).catch(() => {});
  }, [userId]);

  const readFile = async (file) => {
    setFileName(file.name);
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      setRawText(text);
      return text;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve({ base64, mediaType: file.type, fileName: file.name });
      };
      reader.readAsDataURL(file);
    });
  };

  const parseResume = async (fileData) => {
    setParsing(true);
    setActiveTab('parsed');
    try {
      const messages = [];
      if (typeof fileData === 'string') {
        messages.push({ role: 'user', content: `Parse this resume text and extract structured data. Return ONLY valid JSON with no markdown fences.\n\nResume:\n${fileData}` });
      } else {
        messages.push({
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: fileData.mediaType, data: fileData.base64 } },
            { type: 'text', text: 'Parse this resume and extract structured data. Return ONLY valid JSON with no markdown fences.' }
          ]
        });
      }
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 4000,
          system: `You are a resume parser. Extract structured data from resumes. Return ONLY valid JSON (no markdown, no backticks, no explanation) in this exact format:
{
  "contact": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "portfolio": "" },
  "summary": "professional summary or objective statement",
  "experience": [
    { "title": "", "company": "", "dates": "", "highlights": ["bullet point 1", "bullet point 2"] }
  ],
  "skills": ["skill1", "skill2"],
  "education": [
    { "degree": "", "school": "", "year": "" }
  ],
  "metrics": ["$60M revenue impact", "35% adoption increase", "etc — extract all quantified achievements"]
}
Fill in all fields you can find. For metrics, extract EVERY quantified achievement (dollars, percentages, user counts, time savings, etc).`,
          messages
        }),
      });
      const d = await r.json();
      const text = d.content?.map(c => c.text || '').join('') || '';
      const clean = text.replace(/```json\n?|```\n?/g, '').trim();
      const parsed = JSON.parse(clean);
      setResumeData(parsed);
      if (typeof fileData !== 'string') setRawText(text);
      persist(parsed, assessment, rawText, fileName, rewriteResult);
    } catch (err) {
      console.error('Parse error:', err);
      setResumeData({ error: 'Failed to parse resume. Try a different format or paste the text directly.' });
    }
    setParsing(false);
  };

  const assessResume = async () => {
    if (!resumeData || resumeData.error) return;
    setAssessing(true);
    setActiveTab('assessment');
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 4000,
          system: `You are a senior hiring manager and resume expert. Assess this resume for the roles and industry the candidate appears to be targeting, based on their experience and skills. Be specific, actionable, and honest. Return ONLY valid JSON (no markdown, no backticks):
{
  "score": 0-100,
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "issues": [
    {
      "severity": "critical|warning|tip",
      "category": "Metrics|Formatting|ATS|Content|Consistency|Impact",
      "title": "Short issue title",
      "description": "What's wrong and why it matters",
      "fix": "Specific suggested fix"
    }
  ]
}
Check for: missing metrics/numbers, vague bullets, ATS compatibility, inconsistent formatting, weak action verbs, missing keywords for their target roles, gaps in employment, outdated skills, overly long/short sections, and whether achievements show business impact.`,
          messages: [{ role: 'user', content: `Assess this parsed resume:\n${JSON.stringify(resumeData, null, 2)}` }]
        }),
      });
      const d = await r.json();
      const text = d.content?.map(c => c.text || '').join('') || '';
      const clean = text.replace(/```json\n?|```\n?/g, '').trim();
      const result = JSON.parse(clean);
      setAssessment(result);
      persist(resumeData, result, rawText, fileName, rewriteResult);
    } catch (err) {
      console.error('Assessment error:', err);
      setAssessment({ error: 'Assessment failed. Try again.' });
    }
    setAssessing(false);
  };

  const rewriteResume = async () => {
    if (!resumeData || resumeData.error) return;
    setRewriting(true);
    setActiveTab('rewrite');
    try {
      const issueContext = assessment?.issues
        ? `\n\nKnown issues to fix:\n${assessment.issues.map(i => `- [${i.severity}] ${i.title}: ${i.fix}`).join('\n')}`
        : '';
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 4000,
          system: `You are a world-class resume writer. Rewrite the resume to maximize impact for the roles and industry the candidate appears to be targeting. Return ONLY valid JSON (no markdown, no backticks):
{
  "summary": "Rewritten professional summary (2-3 powerful sentences)",
  "experience": [
    {
      "title": "", "company": "", "dates": "",
      "original_highlights": ["original bullet 1"],
      "rewritten_highlights": ["improved bullet 1 — with metrics, impact, and strong verbs"]
    }
  ],
  "changes": [
    { "section": "Summary|Experience|Skills", "before": "original text", "after": "improved text", "reason": "why this is better" }
  ]
}
Rules: Lead every bullet with a strong action verb. Include metrics wherever possible. Show business impact (revenue, users, efficiency). Use concise, active language. Keep each bullet under 2 lines. Target ATS keywords relevant to the candidate's target roles.`,
          messages: [{ role: 'user', content: `Rewrite this resume to maximize impact for the candidate's target roles:${issueContext}\n\nParsed resume:\n${JSON.stringify(resumeData, null, 2)}` }]
        }),
      });
      const d = await r.json();
      const text = d.content?.map(c => c.text || '').join('') || '';
      const clean = text.replace(/```json\n?|```\n?/g, '').trim();
      const result = JSON.parse(clean);
      setRewriteResult(result);
      persist(resumeData, assessment, rawText, fileName, result);
    } catch (err) {
      console.error('Rewrite error:', err);
      setRewriteResult({ error: 'Rewrite failed. Try again.' });
    }
    setRewriting(false);
  };

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
      alert('Please upload a PDF, DOCX, or TXT file.');
      return;
    }
    const fileData = await readFile(file);
    await parseResume(fileData);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handlePasteSubmit = async () => {
    if (!rawText.trim()) return;
    await parseResume(rawText);
  };

  const clearResume = () => {
    setResumeData(null); setAssessment(null); setRawText(''); setFileName('');
    setRewriteResult(null); setActiveTab('upload');
    try { localStorage.removeItem(RESUME_KEY); } catch {}
    if (userId) saveUserResumeDB(userId, {}).catch(() => {});
  };

  const tabs = [
    { key: 'upload', label: 'Upload' },
    { key: 'parsed', label: 'Parsed Resume', disabled: !resumeData },
    { key: 'assessment', label: 'Assessment', disabled: !resumeData },
    { key: 'rewrite', label: 'Rewrite', disabled: !resumeData },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:`1px solid ${T.border}`, paddingBottom:8 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => !t.disabled && setActiveTab(t.key)}
            style={{ padding:'8px 18px', borderRadius:`${T.radius}px ${T.radius}px 0 0`, border:'none',
              background: activeTab === t.key ? T.surface : 'transparent',
              color: t.disabled ? T.dim : activeTab === t.key ? T.mint : T.light,
              fontWeight: activeTab === t.key ? 500 : 400,
              fontSize:13, cursor: t.disabled ? 'default' : 'pointer', fontFamily:T.font,
              borderBottom: activeTab === t.key ? `2px solid ${T.mint}` : '2px solid transparent',
              transition:'all 0.15s ease', opacity: t.disabled ? 0.4 : 1 }}>
            {t.label}
          </button>
        ))}
        {resumeData && !resumeData.error && (
          <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:11, color:T.dim }}>{fileName}</span>
            <Btn small danger onClick={clearResume}>Clear</Btn>
          </div>
        )}
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <Section title="Upload Your Resume" subtitle="PDF, DOCX, or plain text — parsed by AI instantly">
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{ border:`2px dashed ${dragOver ? T.mint : T.border}`, borderRadius:T.radiusLg,
              padding:'48px 24px', textAlign:'center', cursor:'pointer',
              background:dragOver ? T.mintBg : T.surface, transition:'all 0.2s ease', marginBottom:16 }}>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt"
              style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
            <div style={{ fontSize:36, marginBottom:12, opacity:0.6 }}>📄</div>
            <div style={{ fontSize:14, color:T.white, fontWeight:400, marginBottom:4 }}>
              {parsing ? 'Parsing your resume…' : 'Drop your resume here, or click to browse'}
            </div>
            <div style={{ fontSize:12, color:T.muted }}>PDF, DOCX, or TXT</div>
            {parsing && (
              <div style={{ marginTop:16 }}>
                <div style={{ width:200, height:3, background:T.border, borderRadius:2, margin:'0 auto', overflow:'hidden' }}>
                  <div style={{ width:'60%', height:'100%', background:T.mint, borderRadius:2,
                    animation:'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            )}
          </div>

          {/* ─── LinkedIn PDF Import ─── */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.radius,
            padding:'16px 20px', marginBottom:16 }}>
            <div onClick={() => setShowLinkedIn(!showLinkedIn)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>💼</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:500, color:T.white }}>Import from LinkedIn</div>
                  <div style={{ fontSize:11, color:T.muted }}>Export your profile as PDF, then upload it here</div>
                </div>
              </div>
              <span style={{ color:T.muted, fontSize:14, transform:showLinkedIn?'rotate(90deg)':'rotate(0)',
                transition:'transform 0.15s', display:'inline-block' }}>▸</span>
            </div>

            {showLinkedIn && (
              <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${T.border}` }}>
                <div style={{ fontSize:12, color:T.light, lineHeight:1.8, marginBottom:16 }}>
                  <div style={{ fontWeight:600, color:T.mint, marginBottom:8, fontSize:11,
                    textTransform:'uppercase', letterSpacing:0.8 }}>How to export your LinkedIn profile</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    <div style={{ display:'flex', gap:10 }}>
                      <span style={{ fontSize:11, fontWeight:600, color:T.mint, minWidth:18 }}>1.</span>
                      <span>Go to <a href="https://www.linkedin.com/in/me" target="_blank" rel="noopener noreferrer"
                        style={{ color:T.mint, textDecoration:'underline' }}>linkedin.com/in/me</a> and log in</span>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <span style={{ fontSize:11, fontWeight:600, color:T.mint, minWidth:18 }}>2.</span>
                      <span>Click <strong style={{ color:T.white }}>More</strong> (below your banner photo)</span>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <span style={{ fontSize:11, fontWeight:600, color:T.mint, minWidth:18 }}>3.</span>
                      <span>Select <strong style={{ color:T.white }}>Save to PDF</strong></span>
                    </div>
                    <div style={{ display:'flex', gap:10 }}>
                      <span style={{ fontSize:11, fontWeight:600, color:T.mint, minWidth:18 }}>4.</span>
                      <span>Upload the downloaded PDF below</span>
                    </div>
                  </div>
                </div>

                <div onClick={() => linkedInRef.current?.click()}
                  style={{ border:`2px dashed ${T.border}`, borderRadius:T.radius,
                    padding:'20px 16px', textAlign:'center', cursor:'pointer',
                    background:T.bg, transition:'border-color 0.15s ease' }}
                  onMouseOver={e => e.currentTarget.style.borderColor = T.mint}
                  onMouseOut={e => e.currentTarget.style.borderColor = T.border}>
                  <input ref={linkedInRef} type="file" accept=".pdf"
                    style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
                  <div style={{ fontSize:13, color:T.light, fontWeight:400 }}>
                    {parsing ? 'Parsing LinkedIn PDF…' : 'Click to upload your LinkedIn PDF'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <details style={{ marginTop:8 }}>
            <summary style={{ fontSize:12, color:T.muted, cursor:'pointer', fontFamily:T.font }}>
              Or paste resume text directly
            </summary>
            <div style={{ marginTop:8 }}>
              <textarea value={rawText} onChange={e => setRawText(e.target.value)}
                placeholder="Paste your full resume text here…"
                style={{ width:'100%', minHeight:180, padding:14, borderRadius:T.radius,
                  border:`1px solid ${T.border}`, background:T.bg, color:T.white,
                  fontSize:13, fontFamily:T.font, fontWeight:300, resize:'vertical', outline:'none',
                  lineHeight:1.7, boxSizing:'border-box' }} />
              <div style={{ marginTop:8 }}>
                <Btn primary onClick={handlePasteSubmit} disabled={!rawText.trim() || parsing}>
                  {parsing ? 'Parsing…' : 'Parse Resume'}
                </Btn>
              </div>
            </div>
          </details>
        </Section>
      )}

      {/* Parsed Resume Tab */}
      {activeTab === 'parsed' && (
        <div>
          {parsing ? (
            <div style={{ textAlign:'center', padding:60, color:T.muted }}>
              <div style={{ fontSize:16, marginBottom:8 }}>Parsing your resume…</div>
              <div style={{ fontSize:12 }}>Extracting work history, skills, and metrics</div>
            </div>
          ) : resumeData?.error ? (
            <div style={{ textAlign:'center', padding:40, color:T.error }}>
              <div style={{ fontSize:14, marginBottom:12 }}>{resumeData.error}</div>
              <Btn onClick={() => setActiveTab('upload')}>Try Again</Btn>
            </div>
          ) : resumeData ? (
            <Section title="Parsed Resume" subtitle="AI-extracted data from your resume"
              action={<Btn primary onClick={assessResume} disabled={assessing}>
                {assessing ? 'Assessing…' : 'Run Assessment →'}</Btn>}>
              <ResumeDisplay data={resumeData} />
            </Section>
          ) : (
            <div style={{ textAlign:'center', padding:40, color:T.muted }}>
              <Btn onClick={() => setActiveTab('upload')}>Upload a Resume</Btn>
            </div>
          )}
        </div>
      )}

      {/* Assessment Tab */}
      {activeTab === 'assessment' && (
        <div>
          {assessing ? (
            <div style={{ textAlign:'center', padding:60, color:T.muted }}>
              <div style={{ fontSize:16, marginBottom:8 }}>Analyzing your resume…</div>
              <div style={{ fontSize:12 }}>Checking metrics, ATS compatibility, and impact</div>
            </div>
          ) : assessment?.error ? (
            <div style={{ textAlign:'center', padding:40, color:T.error }}>
              <div style={{ fontSize:14, marginBottom:12 }}>{assessment.error}</div>
              <Btn onClick={assessResume}>Retry Assessment</Btn>
            </div>
          ) : assessment ? (
            <div>
              <div style={{ display:'flex', gap:20, alignItems:'center', background:T.surface,
                border:`1px solid ${T.border}`, borderRadius:T.radiusLg, padding:20, marginBottom:20 }}>
                <ScoreRing score={assessment.score} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:500, color:T.white, marginBottom:6 }}>Resume Score</div>
                  <div style={{ fontSize:13, color:T.light, lineHeight:1.7 }}>{assessment.summary}</div>
                  {assessment.strengths && (
                    <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                      {assessment.strengths.map((s, i) => (
                        <span key={i} style={{ fontSize:10, padding:'3px 10px', borderRadius:T.radiusPill,
                          background:T.mintBg, color:T.mint, fontWeight:500 }}>✓ {s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Section title="Issues & Recommendations"
                subtitle={`${assessment.issues?.length || 0} items found`}
                action={<Btn primary onClick={rewriteResume} disabled={rewriting}>
                  {rewriting ? 'Rewriting…' : 'Auto-Rewrite →'}</Btn>}>
                {(assessment.issues || []).map((issue, i) => (
                  <IssueCard key={i} issue={issue} />
                ))}
              </Section>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:40, color:T.muted }}>
              <div style={{ fontSize:14, marginBottom:12 }}>No assessment yet</div>
              <Btn primary onClick={assessResume} disabled={!resumeData || assessing}>
                {assessing ? 'Assessing…' : 'Run Assessment'}</Btn>
            </div>
          )}
        </div>
      )}

      {/* Rewrite Tab */}
      {activeTab === 'rewrite' && (
        <div>
          {rewriting ? (
            <div style={{ textAlign:'center', padding:60, color:T.muted }}>
              <div style={{ fontSize:16, marginBottom:8 }}>Rewriting your resume…</div>
              <div style={{ fontSize:12 }}>Strengthening bullets, adding metrics, optimizing for ATS</div>
            </div>
          ) : rewriteResult?.error ? (
            <div style={{ textAlign:'center', padding:40, color:T.error }}>
              <div style={{ fontSize:14, marginBottom:12 }}>{rewriteResult.error}</div>
              <Btn onClick={rewriteResume}>Retry Rewrite</Btn>
            </div>
          ) : rewriteResult ? (
            <div>
              {rewriteResult.summary && (
                <Section title="Rewritten Summary">
                  <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:T.radius, padding:16 }}>
                    <div style={{ fontSize:13, color:T.mint, lineHeight:1.7, fontWeight:400 }}>{rewriteResult.summary}</div>
                  </div>
                </Section>
              )}
              {rewriteResult.experience && (
                <Section title="Experience — Before vs After"
                  subtitle="Side-by-side comparison of original and improved bullets">
                  {rewriteResult.experience.map((exp, i) => (
                    <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`,
                      borderRadius:T.radius, padding:16, marginBottom:10 }}>
                      <div style={{ fontSize:14, fontWeight:500, color:T.white, marginBottom:4 }}>
                        {exp.title} <span style={{ color:T.muted, fontWeight:400 }}>@ {exp.company}</span>
                      </div>
                      <div style={{ fontSize:11, color:T.dim, marginBottom:12 }}>{exp.dates}</div>
                      {(exp.rewritten_highlights || []).map((rh, j) => (
                        <div key={j} style={{ marginBottom:10 }}>
                          {exp.original_highlights?.[j] && (
                            <div style={{ fontSize:12, color:T.muted, padding:'6px 12px',
                              background:T.errorBg, borderRadius:8, marginBottom:4, lineHeight:1.6,
                              textDecoration:'line-through', opacity:0.7 }}>
                              {exp.original_highlights[j]}
                            </div>
                          )}
                          <div style={{ fontSize:12, color:T.mint, padding:'6px 12px',
                            background:T.mintBg, borderRadius:8, lineHeight:1.6 }}>{rh}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </Section>
              )}
              {rewriteResult.changes && rewriteResult.changes.length > 0 && (
                <Section title="Change Log" subtitle="Why each change was made">
                  {rewriteResult.changes.map((c, i) => (
                    <div key={i} style={{ background:T.surface, border:`1px solid ${T.border}`,
                      borderRadius:T.radius, padding:'12px 16px', marginBottom:6 }}>
                      <div style={{ fontSize:10, color:T.muted, fontWeight:600, textTransform:'uppercase',
                        letterSpacing:0.8, marginBottom:4 }}>{c.section}</div>
                      <div style={{ fontSize:12, color:T.light, lineHeight:1.6 }}>{c.reason}</div>
                    </div>
                  ))}
                </Section>
              )}
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:40, color:T.muted }}>
              <div style={{ fontSize:14, marginBottom:12 }}>No rewrite yet</div>
              <Btn primary onClick={rewriteResume} disabled={!resumeData || rewriting}>
                {rewriting ? 'Rewriting…' : 'Rewrite Resume'}</Btn>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; width: 30%; }
          50% { opacity: 1; width: 80%; }
        }
      `}</style>
    </div>
  );
}
