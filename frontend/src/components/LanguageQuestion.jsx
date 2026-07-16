import { Volume2 } from 'lucide-react';

export default function LanguageQuestion({ question }) {
  const speakText = () => {
    if ('speechSynthesis' in window) {
      // Read exactly what is visible. Model-provided audio must never add an
      // answer, explanation, or hidden hint before the learner reveals it.
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(question.question);
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-Speech is not supported in this browser.');
    }
  };

  return (
    <div>
      <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{question.question}</p>
      <button className="button button-quiet" onClick={speakText}>
        <Volume2 size={18} /> Listen to Question
      </button>
    </div>
  );
}
