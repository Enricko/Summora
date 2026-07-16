import { useState } from 'react'
import { Sparkles, Globe, Brain, Loader } from 'lucide-react'
import QuizCard from './components/QuizCard'

function App() {
  const [text, setText] = useState('')
  const [quizType, setQuizType] = useState('mixed')
  const [level, setLevel] = useState('university')
  const [useWeb, setUseWeb] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const generateQuiz = async () => {
    if (!text.trim()) {
      setError('Please enter some text or a topic to generate a quiz.')
      return
    }
    setError('')
    setLoading(true)
    try {
      let documentText = text;
      
      if (useWeb) {
        const researchRes = await fetch('http://localhost:8000/api/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: text })
        });
        if (!researchRes.ok) throw new Error('Web research failed')
        const researchData = await researchRes.json();
        documentText = researchData.document_text;
      }

      const quizRes = await fetch('http://localhost:8000/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: documentText,
          quiz_type: quizType,
          count: 5,
          education_level: level
        })
      });

      if (!quizRes.ok) throw new Error('Quiz generation failed')
      const data = await quizRes.json();
      setResult(data);
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Summora <Sparkles style={{color: 'var(--accent-pink)'}} /></h1>
        <p style={{color: 'var(--text-muted)'}}>Intelligent, Multi-modal Quiz Generation</p>
      </header>

      <main>
        <section className="glass-panel">
          <div className="form-group">
            <label>Source Text or Topic</label>
            <textarea 
              className="textarea" 
              rows={5} 
              placeholder="Paste your educational text here, or if using Web Research, enter a topic..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap'}}>
            <div style={{flex: 1, minWidth: '150px'}}>
              <label className="form-group" style={{display:'block'}}>Quiz Type</label>
              <select className="select" value={quizType} onChange={e => setQuizType(e.target.value)}>
                <option value="mixed">Mixed (All Types)</option>
                <option value="image">Preschool (Images)</option>
                <option value="essay">Middle School (Essay)</option>
                <option value="math">Math (Formulas)</option>
                <option value="language">Language (TTS)</option>
              </select>
            </div>
            
            <div style={{flex: 1, minWidth: '150px'}}>
              <label className="form-group" style={{display:'block'}}>Education Level</label>
              <select className="select" value={level} onChange={e => setLevel(e.target.value)}>
                <option value="preschool">Preschool</option>
                <option value="middle_school">Middle School</option>
                <option value="high_school">High School</option>
                <option value="university">University</option>
              </select>
            </div>
          </div>

          <div className="form-group" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <input 
              type="checkbox" 
              id="webresearch"
              checked={useWeb} 
              onChange={e => setUseWeb(e.target.checked)} 
              style={{width: '20px', height: '20px', cursor: 'pointer'}}
            />
            <label htmlFor="webresearch" style={{marginBottom: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <Globe size={18} /> Enable Online Connection (Web Research)
            </label>
          </div>

          {error && <div style={{color: 'var(--accent-pink)', marginBottom: '1rem'}}>{error}</div>}

          <button className="btn" onClick={generateQuiz} disabled={loading}>
            {loading ? <span className="loader"></span> : <Brain size={20} />}
            {loading ? 'Generating...' : 'Generate Quiz'}
          </button>
        </section>

        {result && (
          <section style={{marginTop: '3rem'}}>
            <h2 style={{marginBottom: '1.5rem'}}>Your Custom Quiz</h2>
            <div className="grid">
              {result.quiz.flashcards.map((q, idx) => (
                <QuizCard key={idx} question={q} index={idx} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
