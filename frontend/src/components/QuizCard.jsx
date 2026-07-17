import { BlockMath } from 'react-katex'
import { Check, Volume2, X } from 'lucide-react'
import MathQuestion from './MathQuestion'
import LanguageQuestion from './LanguageQuestion'
import ImageQuestion from './ImageQuestion'
import EssayQuestion from './EssayQuestion'

const speak = (text) => {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

function MultipleChoiceInput({ question, value, onChange, disabled }) {
  return (
    <fieldset className="choice-list" disabled={disabled}>
      <legend className="sr-only">Choose one answer</legend>
      {question.options.map((option, optionIndex) => (
        <label className={Number(value) === optionIndex ? 'selected' : ''} key={`${option}-${optionIndex}`}>
          <input
            type="radio"
            name={`question-${question.question_id}`}
            checked={Number(value) === optionIndex}
            onChange={() => onChange(optionIndex)}
          />
          <span>{String.fromCharCode(65 + optionIndex)}</span>
          {option}
        </label>
      ))}
    </fieldset>
  )
}

function MatchingInput({ question, value = {}, onChange, disabled }) {
  return (
    <div className="matching-list">
      {question.left_items.map((left, index) => (
        <label key={`${left}-${index}`}>
          <span><strong>{index + 1}</strong>{left}</span>
          <select
            value={value[left] || ''}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, [left]: event.target.value })}
          >
            <option value="">Choose a match</option>
            {question.right_options.map((option) => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
      ))}
    </div>
  )
}

export default function QuizCard({ question, index, value, onChange, grade }) {
  const disabled = Boolean(grade)

  const questionContent = () => {
    switch (question.type) {
      case 'math': return <MathQuestion question={question} />
      case 'language': return <LanguageQuestion question={question} />
      case 'image': return <ImageQuestion question={question} />
      case 'essay': return <EssayQuestion question={question} value={value || ''} onChange={onChange} disabled={disabled} />
      case 'multiple_choice': return (
        <>
          <p className="question-text">{question.question}</p>
          <MultipleChoiceInput question={question} value={value} onChange={onChange} disabled={disabled} />
        </>
      )
      case 'matching': return (
        <>
          <p className="question-text">{question.question}</p>
          <MatchingInput question={question} value={value} onChange={onChange} disabled={disabled} />
        </>
      )
      default: return <p className="question-text">{question.question}</p>
    }
  }

  const needsTextResponse = !['essay', 'multiple_choice', 'matching'].includes(question.type)

  return (
    <article className={`quiz-card ${grade ? (grade.correct ? 'graded-correct' : 'graded-review') : ''}`}>
      <div className="question-meta">
        <span>Q{index + 1}</span>
        <div>
          <span className={`difficulty ${question.difficulty}`}>{question.difficulty}</span>
          <span className="type-badge">{question.type.replace('_', ' ')}</span>
          <button className="speak-button" onClick={() => speak(question.question)} aria-label="Read question aloud">
            <Volume2 size={16} />
          </button>
        </div>
      </div>

      {questionContent()}

      {needsTextResponse && (
        <label className="response-field">
          <span>Your answer</span>
          <textarea
            rows={4}
            value={value || ''}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Write your answer before submitting the quiz…"
          />
        </label>
      )}

      <p className="source-note">Sources: {(question.citations || [question.source_section]).join(' · ')}</p>

      {grade && (
        <div className="answer-area" aria-live="polite">
          <div className="answer-heading">
            <span>{grade.correct ? <Check size={17} /> : <X size={17} />}{grade.score}% · {grade.correct ? 'Correct' : 'Review'}</span>
          </div>
          <p><strong>Answer key:</strong> {grade.expected_answer}</p>
          {grade.mapping_latex && <BlockMath math={grade.mapping_latex} />}
          <p><strong>Explanation:</strong> {grade.explanation}</p>
          <p className="grader-feedback"><strong>Feedback:</strong> {grade.feedback}</p>
          {grade.strengths?.length > 0 && <p><strong>Strengths:</strong> {grade.strengths.join(' ')}</p>}
          {grade.improvements?.length > 0 && <p><strong>Improve:</strong> {grade.improvements.join(' ')}</p>}
        </div>
      )}
    </article>
  )
}
