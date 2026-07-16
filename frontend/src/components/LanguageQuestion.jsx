import { Volume2 } from 'lucide-react';

export default function LanguageQuestion({ question }) {
  const speakText = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(question.audio_text || question.question);
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-Speech is not supported in this browser.');
    }
  };

  return (
    <div>
      <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{question.question}</p>
      {question.pronunciation_guide && (
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1rem' }}>
          Pronunciation: {question.pronunciation_guide}
        </p>
      )}
      <button className="btn" onClick={speakText} style={{ background: 'var(--accent-cyan)' }}>
        <Volume2 size={18} /> Listen to Question
      </button>
    </div>
  );
}
