import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

export default function MathQuestion({ question }) {
  return (
    <div>
      <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{question.question}</p>
      {question.latex_formula && (
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', overflowX: 'auto' }}>
          <BlockMath math={question.latex_formula} />
        </div>
      )}
    </div>
  );
}
