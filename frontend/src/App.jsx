import { useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BookOpen, Brain, Check, ChevronDown,
  FileText, Globe2, GraduationCap, ListChecks, RotateCcw, Sparkles, Upload,
} from 'lucide-react'
import QuizCard from './components/QuizCard'

// In development Vite proxies /api to the backend. This keeps requests same-origin
// in Safari and avoids localhost/127.0.0.1 and CORS mismatches.
const API_URL = import.meta.env.VITE_API_URL || ''

function App() {
  const [text, setText] = useState('')
  const [quizType, setQuizType] = useState('mixed')
  const [level, setLevel] = useState('university')
  const [summaryLength, setSummaryLength] = useState('medium')
  const [questionCount, setQuestionCount] = useState(5)
  const [useWeb, setUseWeb] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('summary')
  const [summaryView, setSummaryView] = useState('short')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const fileInputRef = useRef(null)
  const resultsRef = useRef(null)

  const quiz = result?.quiz?.flashcards || []
  const answeredCount = Object.keys(answers).length
  const confidenceScore = useMemo(() => {
    if (!answeredCount) return 0
    const understood = Object.values(answers).filter(Boolean).length
    return Math.round((understood / answeredCount) * 100)
  }, [answers, answeredCount])

  const readError = async (response, fallback) => {
    try {
      const payload = await response.json()
      return payload.detail || fallback
    } catch {
      return fallback
    }
  }

  const generateSession = async () => {
    if (!text.trim()) {
      setError('Add learning material or enter a research topic first.')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)
    setAnswers({})
    setCurrentQuestion(0)
    try {
      let documentText = text
      if (useWeb) {
        const researchRes = await fetch(`${API_URL}/api/research`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text.substring(0, 1500) }),
        })
        if (!researchRes.ok) throw new Error(await readError(researchRes, 'Web research failed.'))
        documentText = (await researchRes.json()).document_text
      }

      const response = await fetch(`${API_URL}/api/quiz`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: documentText, quiz_type: quizType, count: questionCount,
          education_level: level, summary_length: summaryLength,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, 'The learning session could not be generated.'))
      setResult(await response.json())
      setActiveTab('summary')
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (err) {
      const message = err instanceof TypeError
        ? 'Could not reach the Summora server. Check that the backend is running, then try again.'
        : err.message
      setError(message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      setError('Please choose a PDF file.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_URL}/api/upload_pdf`, { method: 'POST', body: formData })
      if (!response.ok) throw new Error(await readError(response, 'The PDF could not be read.'))
      setText((await response.json()).text)
    } catch (err) {
      setError(err.message || 'The PDF could not be read.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const resetSession = () => {
    setResult(null)
    setAnswers({})
    setCurrentQuestion(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Summora home">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span>Summora</span>
        </a>
        <span className="topbar-note">AI study companion</span>
      </header>

      <main id="top" className="page">
        <section className="hero">
          <span className="eyebrow"><Brain size={16} /> Read less. Learn more.</span>
          <h1>Turn any lesson into a<br /><span>clear study session.</span></h1>
          <p>Summora’s agents read your material, explain the essentials, build a quiz, and review the result for quality.</p>
        </section>

        <section className="composer" aria-labelledby="composer-title">
          <div className="composer-heading">
            <div>
              <p className="step-label">01 · Add your material</p>
              <h2 id="composer-title">What are you learning?</h2>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf" hidden onChange={handleFileUpload} />
            <button className="button button-quiet" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload size={17} /> {uploading ? 'Reading PDF…' : 'Upload PDF'}
            </button>
          </div>

          <label className="sr-only" htmlFor="source-text">Source text or research topic</label>
          <textarea
            id="source-text" className="source-input" rows={8}
            placeholder={useWeb ? 'Enter a topic to research, for example: How do neural networks learn?' : 'Paste notes, an article, or a chapter here…'}
            value={text} onChange={(event) => setText(event.target.value)}
          />
          <div className="input-meta">
            <span>{text.trim() ? `${text.trim().split(/\s+/).length.toLocaleString()} words` : 'PDF or pasted text'}</span>
            <label className="switch-row">
              <input type="checkbox" checked={useWeb} onChange={(event) => setUseWeb(event.target.checked)} />
              <span className="switch" aria-hidden="true" />
              <Globe2 size={16} /> Research the web
            </label>
          </div>

          <div className="settings-grid">
            <SelectField icon={<GraduationCap size={17} />} label="Learning level" value={level} onChange={setLevel} options={[
              ['preschool', 'Preschool'], ['middle_school', 'Middle school'], ['high_school', 'High school'], ['university', 'University'],
            ]} />
            <SelectField icon={<FileText size={17} />} label="Summary depth" value={summaryLength} onChange={setSummaryLength} options={[
              ['short', 'Quick'], ['medium', 'Balanced'], ['detailed', 'Detailed'],
            ]} />
            <SelectField icon={<ListChecks size={17} />} label="Quiz style" value={quizType} onChange={setQuizType} options={[
              ['mixed', 'Mixed'], ['standard', 'Flashcards'], ['essay', 'Essay'], ['math', 'Math'], ['language', 'Language'], ['image', 'Visual'],
            ]} />
            <SelectField icon={<BookOpen size={17} />} label="Questions" value={String(questionCount)} onChange={(value) => setQuestionCount(Number(value))} options={[
              ['3', '3 questions'], ['5', '5 questions'], ['8', '8 questions'], ['10', '10 questions'],
            ]} />
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}
          <button className="button button-primary generate-button" onClick={generateSession} disabled={loading || uploading}>
            {loading ? <span className="spinner" /> : <Sparkles size={19} />}
            {loading ? 'Agents are building your session…' : 'Create study session'}
          </button>
          {loading && <div className="agent-progress" aria-live="polite"><span>Reader</span><i /><span>Summarizer</span><i /><span>Quiz maker</span><i /><span>Reviewer</span></div>}
        </section>

        {result && (
          <section className="results" ref={resultsRef} aria-labelledby="results-title">
            <div className="results-heading">
              <div>
                <p className="step-label">02 · Your study session</p>
                <h2 id="results-title">{result.document?.subject || 'Learning material'}</h2>
                <p>{result.document?.sections?.length || 0} source sections · Quality reviewed</p>
              </div>
              <div className="quality-badge"><Check size={16} /> {result.review?.quality_score || '—'}% quality</div>
            </div>

            <div className="tabs" role="tablist" aria-label="Study session sections">
              <button role="tab" aria-selected={activeTab === 'summary'} className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}><BookOpen size={17} /> Summary</button>
              <button role="tab" aria-selected={activeTab === 'quiz'} className={activeTab === 'quiz' ? 'active' : ''} onClick={() => setActiveTab('quiz')}><Brain size={17} /> Quiz <span>{quiz.length}</span></button>
            </div>

            {activeTab === 'summary' ? (
              <SummaryPanel summary={result.summary} view={summaryView} setView={setSummaryView} />
            ) : (
              <div className="quiz-panel">
                <div className="quiz-status">
                  <div><span>Question {currentQuestion + 1} of {quiz.length}</span><strong>{answeredCount}/{quiz.length} reflected</strong></div>
                  <div className="progress-track"><span style={{ width: `${((currentQuestion + 1) / quiz.length) * 100}%` }} /></div>
                </div>
                <QuizCard
                  key={currentQuestion}
                  question={quiz[currentQuestion]}
                  index={currentQuestion}
                  assessment={answers[currentQuestion]}
                  onAssess={(understood) => setAnswers((current) => ({ ...current, [currentQuestion]: understood }))}
                />
                <div className="quiz-navigation">
                  <button className="button button-quiet" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((value) => value - 1)}><ArrowLeft size={17} /> Previous</button>
                  {currentQuestion < quiz.length - 1 ? (
                    <button className="button button-primary" onClick={() => setCurrentQuestion((value) => value + 1)}>Next question <ArrowRight size={17} /></button>
                  ) : (
                    <div className="score-pill">Confidence: <strong>{confidenceScore}%</strong></div>
                  )}
                </div>
              </div>
            )}

            <button className="start-over" onClick={resetSession}><RotateCcw size={16} /> Start with new material</button>
          </section>
        )}
      </main>
    </div>
  )
}

function SelectField({ icon, label, value, onChange, options }) {
  return (
    <label className="select-field">
      <span>{icon}{label}</span>
      <div><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select><ChevronDown size={16} /></div>
    </label>
  )
}

function SummaryPanel({ summary, view, setView }) {
  return (
    <div className="summary-panel">
      <div className="summary-main">
        <div className="segmented" aria-label="Summary length">
          <button className={view === 'short' ? 'active' : ''} onClick={() => setView('short')}>Quick read</button>
          <button className={view === 'detailed' ? 'active' : ''} onClick={() => setView('detailed')}>Deep dive</button>
        </div>
        <p className="summary-copy">{view === 'short' ? summary.short_summary : summary.detailed_summary}</p>
        <h3>Key ideas</h3>
        <ol className="key-points">{summary.key_points.map((item, index) => <li key={`${item.point}-${index}`}><span>{index + 1}</span><div>{item.point}<small>{item.source_section}</small></div></li>)}</ol>
      </div>
      <aside className="terms-panel">
        <h3>Essential terms</h3>
        {summary.important_terms.length ? summary.important_terms.map((item) => (
          <div className="term" key={item.term}><strong>{item.term}</strong><p>{item.definition}</p></div>
        )) : <p className="muted">No essential terms were identified in this material.</p>}
        {summary.learning_recommendations.length > 0 && <div className="study-tip"><Sparkles size={17} /><div><strong>Study next</strong><p>{summary.learning_recommendations[0]}</p></div></div>}
      </aside>
    </div>
  )
}

export default App
