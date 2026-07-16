import { useState } from 'react'
import MathQuestion from './MathQuestion'
import LanguageQuestion from './LanguageQuestion'
import ImageQuestion from './ImageQuestion'
import EssayQuestion from './EssayQuestion'
import { Check, Eye, RotateCcw, X } from 'lucide-react'

export default function QuizCard({ question, index, assessment, onAssess }) {
  const [revealed, setRevealed] = useState(false)

  const content = () => {
    switch (question.type) {
      case 'math': return <MathQuestion question={question} />
      case 'language': return <LanguageQuestion question={question} />
      case 'image': return <ImageQuestion question={question} />
      case 'essay': return <EssayQuestion question={question} />
      default: return <p className="question-text">{question.question}</p>
    }
  }

  return (
    <article className="quiz-card">
      <div className="question-meta">
        <span>Q{index + 1}</span>
        <div><span className={`difficulty ${question.difficulty}`}>{question.difficulty}</span><span className="type-badge">{question.type}</span></div>
      </div>
      {content()}
      <p className="source-note">From: {question.source_section}</p>

      {!revealed ? (
        <button className="button answer-button" onClick={() => setRevealed(true)}><Eye size={18} /> Show answer</button>
      ) : (
        <div className="answer-area">
          <div className="answer-heading"><span><Check size={17} /> Answer</span><button onClick={() => setRevealed(false)} aria-label="Hide answer"><RotateCcw size={16} /></button></div>
          <p>{question.answer}</p>
          <div className="reflection">
            <span>Did you get it?</span>
            <button className={assessment === false ? 'selected review' : ''} onClick={() => onAssess(false)}><X size={16} /> Review again</button>
            <button className={assessment === true ? 'selected understood' : ''} onClick={() => onAssess(true)}><Check size={16} /> I understood</button>
          </div>
        </div>
      )}
    </article>
  )
}
