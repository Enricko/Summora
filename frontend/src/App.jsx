import { useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BookOpen, Brain, Check, ChevronDown, Download,
  FileText, Globe2, GraduationCap, History, ListChecks, Printer, RefreshCw,
  RotateCcw, ShieldCheck, Shuffle, Sparkles, Trophy, Upload, Volume2,
} from 'lucide-react'
import QuizCard from './components/QuizCard'

const API_URL = import.meta.env.VITE_API_URL || ''
const MAX_WEB_SEARCH_QUERY_LENGTH = 399
const HISTORY_KEY = 'summora-session-history-v1'

const buildWebSearchQuery = (value) => {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length <= MAX_WEB_SEARCH_QUERY_LENGTH) return normalized
  const clipped = normalized.slice(0, MAX_WEB_SEARCH_QUERY_LENGTH - 3)
  const lastSpace = clipped.lastIndexOf(' ')
  const wordSafe = lastSpace > MAX_WEB_SEARCH_QUERY_LENGTH / 2 ? clipped.slice(0, lastSpace) : clipped
  return `${wordSafe.replace(/[\s,.;:!?-]+$/, '')}...`
}

const loadHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

const speakText = (value) => {
  if (!('speechSynthesis' in window)) return false
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(value))
  return true
}

function App() {
  const [text, setText] = useState('')
  const [quizType, setQuizType] = useState('mixed')
  const [level, setLevel] = useState('university')
  const [summaryLength, setSummaryLength] = useState('medium')
  const [questionCount, setQuestionCount] = useState(5)
  const [useWeb, setUseWeb] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [grading, setGrading] = useState(false)
  const [result, setResult] = useState(null)
  const [grade, setGrade] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('summary')
  const [summaryView, setSummaryView] = useState('short')
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [history, setHistory] = useState(loadHistory)
  const fileInputRef = useRef(null)
  const resultsRef = useRef(null)

  const quiz = useMemo(() => result?.quiz?.flashcards || [], [result])
  const gradeByQuestion = useMemo(
    () => Object.fromEntries((grade?.results || []).map((item) => [item.question_id, item])),
    [grade],
  )
  const answeredCount = useMemo(() => quiz.filter((question) => {
    const value = answers[question.question_id]
    if (question.type === 'matching') {
      return question.left_items.every((left) => Boolean(value?.[left]))
    }
    return value !== undefined && value !== null && String(value).trim() !== ''
  }).length, [answers, quiz])

  const readError = async (response, fallback) => {
    try {
      const payload = await response.json()
      return typeof payload.detail === 'string' ? payload.detail : fallback
    } catch {
      return fallback
    }
  }

  const createSession = async ({ variation = false } = {}) => {
    if (!text.trim()) {
      setError('Add learning material or enter a research topic first.')
      return
    }
    setError('')
    setLoading(true)
    setGrade(null)
    setAnswers({})
    setCurrentQuestion(0)
    try {
      let documentText = text
      let sourceReferences = []
      if (useWeb) {
        const researchRes = await fetch(`${API_URL}/api/research`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: buildWebSearchQuery(text) }),
        })
        if (!researchRes.ok) {
          throw new Error(await readError(
            researchRes,
            'Web research could not be completed. Try a shorter topic or turn off web research.',
          ))
        }
        const researchPayload = await researchRes.json()
        documentText = `${text}\n\n# Supplemental Web Research\n\n${researchPayload.document_text}`
        sourceReferences = researchPayload.research.sources.map((source) => ({
          source_id: source.source_id,
          label: `[${source.source_id}] ${source.title}`,
          source_section: `[${source.source_id}] ${source.title}`,
          url: source.url,
        }))
      }

      const response = await fetch(`${API_URL}/api/quiz`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: documentText,
          quiz_type: quizType,
          count: questionCount,
          education_level: level,
          summary_length: summaryLength,
          variation_seed: variation ? String(Date.now()) : null,
          excluded_questions: variation ? quiz.map((item) => item.question) : [],
          source_references: sourceReferences,
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

  const submitQuiz = async () => {
    if (answeredCount !== quiz.length) {
      setError(`Answer all ${quiz.length} questions before submitting. ${quiz.length - answeredCount} remaining.`)
      return
    }
    setError('')
    setGrading(true)
    try {
      const response = await fetch(`${API_URL}/api/grade_quiz`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_id: result.quiz_id, answers }),
      })
      if (!response.ok) throw new Error(await readError(response, 'The quiz could not be graded.'))
      const payload = await response.json()
      setGrade(payload)
      const entry = {
        ...payload.session_log,
        content_accuracy: payload.diagnostic.content_accuracy,
        grading_confidence: payload.diagnostic.grading_confidence,
      }
      const nextHistory = [entry, ...history.filter((item) => item.quiz_id !== entry.quiz_id)].slice(0, 20)
      setHistory(nextHistory)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
    } catch (err) {
      setError(err.message || 'The quiz could not be graded. Try again.')
    } finally {
      setGrading(false)
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

  const shuffleQuiz = () => {
    setResult((current) => {
      const shuffled = [...current.quiz.flashcards]
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1))
        ;[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]]
      }
      return { ...current, quiz: { ...current.quiz, flashcards: shuffled } }
    })
    setCurrentQuestion(0)
  }

  const downloadSession = () => {
    const payload = {
      format: 'summora-learning-session-v1',
      session: result,
      submission: grade,
      learner_answers: answers,
      exported_at: new Date().toISOString(),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `summora-${result.session_id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const resetSession = () => {
    setResult(null)
    setGrade(null)
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
        <span className="topbar-note">AI study companion · {history.length} completed sessions</span>
      </header>

      <main id="top" className="page">
        <section className="hero">
          <span className="eyebrow"><Brain size={16} /> Read less. Learn more.</span>
          <h1>Turn any lesson into a<br /><span>clear study session.</span></h1>
          <p>Learn from cited material, complete an adaptive quiz, then unlock a scored answer key with detailed feedback.</p>
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
            placeholder={useWeb ? 'Enter a topic or paste material to supplement with cited research…' : 'Paste notes, an article, or a chapter here…'}
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
            <SelectField icon={<FileText size={17} />} label="Material depth" value={summaryLength} onChange={setSummaryLength} options={[
              ['short', 'Quick'], ['medium', 'Balanced'], ['detailed', 'Detailed'],
            ]} />
            <SelectField icon={<ListChecks size={17} />} label="Quiz style" value={quizType} onChange={setQuizType} options={[
              ['mixed', 'Adaptive mix'], ['multiple_choice', 'Multiple choice'], ['matching', 'Matching'],
              ['standard', 'Short answer'], ['essay', 'Essay'], ['math', 'Math'], ['language', 'Language'], ['image', 'Visual'],
            ]} />
            <SelectField icon={<BookOpen size={17} />} label="Questions" value={String(questionCount)} onChange={(value) => setQuestionCount(Number(value))} options={[
              ['3', '3 questions'], ['5', '5 questions'], ['8', '8 questions'], ['10', '10 questions'],
            ]} />
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}
          <button className="button button-primary generate-button" onClick={() => createSession()} disabled={loading || uploading}>
            {loading ? <span className="spinner" /> : <Sparkles size={19} />}
            {loading ? 'Agents are building your session…' : 'Create study session'}
          </button>
          {loading && <div className="agent-progress" aria-live="polite"><span>Reader</span><i /><span>Materials</span><i /><span>Quiz maker</span><i /><span>Reviewer</span></div>}
        </section>

        {result && (
          <section className={`results theme-${result.adaptive_style?.theme || 'balanced'}`} ref={resultsRef} aria-labelledby="results-title">
            <div className="results-heading">
              <div>
                <p className="step-label">02 · Your adaptive learning module</p>
                <h2 id="results-title">{result.document?.subject || 'Learning material'}</h2>
                <p>{result.document?.sections?.length || 0} source sections · {result.adaptive_style?.content_style}</p>
              </div>
              <div className="quality-badge"><ShieldCheck size={16} /> {result.accuracy_diagnostic?.score || '—'}% content confidence</div>
            </div>

            <div className="session-actions" aria-label="Session actions">
              <button className="button button-quiet" onClick={shuffleQuiz} disabled={Boolean(grade)}><Shuffle size={16} /> Shuffle</button>
              <button className="button button-quiet" onClick={() => createSession({ variation: true })} disabled={loading}><RefreshCw size={16} /> New variation</button>
              <button className="button button-quiet" onClick={downloadSession}><Download size={16} /> JSON</button>
              <button className="button button-quiet" onClick={() => window.print()}><Printer size={16} /> Print / PDF</button>
            </div>

            <div className="tabs" role="tablist" aria-label="Study session sections">
              <button role="tab" aria-selected={activeTab === 'summary'} className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}><BookOpen size={17} /> Materials</button>
              <button role="tab" aria-selected={activeTab === 'quiz'} className={activeTab === 'quiz' ? 'active' : ''} onClick={() => setActiveTab('quiz')}><Brain size={17} /> Quiz <span>{quiz.length}</span></button>
              <button role="tab" aria-selected={activeTab === 'history'} className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}><History size={17} /> History <span>{history.length}</span></button>
            </div>

            {activeTab === 'summary' && (
              <SummaryPanel
                summary={result.summary}
                references={result.references}
                profile={result.adaptive_style}
                view={summaryView}
                setView={setSummaryView}
                onStartQuiz={() => { setActiveTab('quiz'); setCurrentQuestion(0) }}
              />
            )}

            {activeTab === 'quiz' && (
              <div className="quiz-panel">
                {grade && (
                  <div className="score-summary" role="status">
                    <Trophy size={26} />
                    <div><span>Final score</span><strong>{grade.final_score}%</strong><small>{grade.correct_count} of {grade.question_count} passed · {grade.diagnostic.grading_confidence}% grading confidence</small></div>
                  </div>
                )}
                <div className="quiz-status">
                  <div><span>Question {currentQuestion + 1} of {quiz.length}</span><strong>{answeredCount}/{quiz.length} answered</strong></div>
                  <div className="progress-track"><span style={{ width: `${((currentQuestion + 1) / quiz.length) * 100}%` }} /></div>
                </div>
                <QuizCard
                  key={quiz[currentQuestion].question_id}
                  question={quiz[currentQuestion]}
                  index={currentQuestion}
                  value={answers[quiz[currentQuestion].question_id]}
                  onChange={(value) => setAnswers((current) => ({ ...current, [quiz[currentQuestion].question_id]: value }))}
                  grade={gradeByQuestion[quiz[currentQuestion].question_id]}
                />
                <div className="quiz-navigation">
                  <button className="button button-quiet" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((value) => value - 1)}><ArrowLeft size={17} /> Previous</button>
                  {currentQuestion < quiz.length - 1 ? (
                    <button className="button button-primary" onClick={() => setCurrentQuestion((value) => value + 1)}>Next question <ArrowRight size={17} /></button>
                  ) : !grade ? (
                    <button className="button button-primary" disabled={grading || answeredCount !== quiz.length} onClick={submitQuiz}>
                      {grading ? <span className="spinner" /> : <Check size={17} />}{grading ? 'Grading responses…' : 'Submit and reveal answers'}
                    </button>
                  ) : (
                    <div className="score-pill">Completed: <strong>{grade.final_score}%</strong></div>
                  )}
                </div>
                {!grade && answeredCount !== quiz.length && <p className="submit-hint">Answer every question to unlock scoring and the answer key.</p>}
              </div>
            )}

            {activeTab === 'history' && <HistoryPanel history={history} />}

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

function SummaryPanel({ summary, references, profile, view, setView, onStartQuiz }) {
  const materialSpeech = summary.learning_materials.map((item) => `${item.title}. ${item.explanation}. Key takeaway: ${item.key_takeaway}`).join(' ')
  return (
    <div className="materials-view">
      <div className="learning-profile">
        <div><Sparkles size={18} /><span>Adaptive style</span><strong>{profile.content_style}</strong></div>
        <div><GraduationCap size={18} /><span>Tone</span><strong>{profile.tone}</strong></div>
        <button className="button button-quiet" onClick={() => speakText(materialSpeech)}><Volume2 size={17} /> Listen to materials</button>
      </div>

      <div className="learning-materials">
        <div className="section-heading"><div><p className="step-label">Learn first</p><h3>Guided material</h3></div><span>{summary.learning_materials.length} sections</span></div>
        <div className="material-grid">
          {summary.learning_materials.map((item, index) => (
            <article key={`${item.title}-${index}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h4>{item.title}</h4>
              <p>{item.explanation}</p>
              <strong>{item.key_takeaway}</strong>
              <small>Sources: {item.source_sections.join(' · ')}</small>
            </article>
          ))}
        </div>
      </div>

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

      <div className="reference-panel">
        <h3>References</h3>
        <ul>{references.map((reference, index) => <li key={`${reference.label || reference.source_section}-${index}`}>{reference.url ? <a href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a> : (reference.label || reference.source_section)}</li>)}</ul>
      </div>

      <button className="button button-primary begin-quiz" onClick={onStartQuiz}><Brain size={18} /> Begin scored quiz</button>
    </div>
  )
}

function HistoryPanel({ history }) {
  if (!history.length) return <div className="empty-history"><History size={30} /><h3>No completed sessions yet</h3><p>Submit a quiz to create the first structured history record.</p></div>
  return (
    <div className="history-panel">
      <div className="section-heading"><div><p className="step-label">Local history</p><h3>Past performance</h3></div><span>Stored on this device</span></div>
      <div className="history-list">
        {history.map((item) => (
          <article key={item.quiz_id}>
            <div><strong>{item.subject}</strong><span>{new Date(item.completed_at).toLocaleString()}</span></div>
            <strong>{item.score}%</strong>
            <small>Content {item.content_accuracy}% · grading confidence {item.grading_confidence}%</small>
          </article>
        ))}
      </div>
    </div>
  )
}

export default App
