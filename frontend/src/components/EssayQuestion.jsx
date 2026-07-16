export default function EssayQuestion({ question }) {
  return (
    <div>
      <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{question.question}</p>
      <textarea 
        className="textarea" 
        rows={6} 
        placeholder="Write your essay here..."
        style={{ marginBottom: '1rem' }}
      />
      {question.rubric && (
        <div style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid var(--accent-pink)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
          <strong style={{ color: 'var(--accent-pink)', display: 'block', marginBottom: '0.5rem' }}>Grading Rubric:</strong>
          {question.rubric}
        </div>
      )}
    </div>
  );
}
