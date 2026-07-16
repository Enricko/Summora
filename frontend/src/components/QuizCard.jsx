import { useState } from 'react';
import MathQuestion from './MathQuestion';
import LanguageQuestion from './LanguageQuestion';
import ImageQuestion from './ImageQuestion';
import EssayQuestion from './EssayQuestion';
import { HelpCircle, CheckCircle } from 'lucide-react';

export default function QuizCard({ question, index }) {
  const [revealed, setRevealed] = useState(false);

  const getDifficultyClass = (diff) => {
    switch (diff) {
      case 'easy': return 'badge-easy';
      case 'medium': return 'badge-medium';
      case 'hard': return 'badge-hard';
      default: return 'badge-easy';
    }
  }

  const renderContent = () => {
    switch (question.type) {
      case 'math':
        return <MathQuestion question={question} />;
      case 'language':
        return <LanguageQuestion question={question} />;
      case 'image':
        return <ImageQuestion question={question} />;
      case 'essay':
        return <EssayQuestion question={question} />;
      default:
        return <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{question.question}</p>;
    }
  }

  return (
    <div className="question-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Q{index + 1}</span>
        <div>
          <span className={`badge ${getDifficultyClass(question.difficulty)}`}>{question.difficulty}</span>
          <span className="badge badge-type">{question.type}</span>
        </div>
      </div>
      
      {renderContent()}

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
        {!revealed ? (
          <button className="btn btn-secondary" onClick={() => setRevealed(true)} style={{ width: '100%' }}>
            <HelpCircle size={18} /> Reveal Answer
          </button>
        ) : (
          <div style={{ width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setRevealed(false)} style={{ width: '100%', marginBottom: '1rem', background: 'rgba(74, 222, 128, 0.1)', borderColor: '#4ade80', color: '#4ade80' }}>
              <CheckCircle size={18} /> Hide Answer
            </button>
            <div className="answer-reveal">
              <strong>Answer:</strong> {question.answer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
