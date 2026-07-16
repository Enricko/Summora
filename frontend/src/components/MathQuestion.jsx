import 'katex/dist/katex.min.css'
import { BlockMath } from 'react-katex'
import { Sigma } from 'lucide-react'
import { toFormulaHint, toPlainFormula } from '../utils/formula'

export default function MathQuestion({ question }) {
  const formula = toFormulaHint(question.latex_formula, question.question)
  const plainFormula = toPlainFormula(formula)

  return (
    <div className="math-question">
      <p>{question.question}</p>
      {formula && (
        <div className="formula-panel" aria-label={`Formula: ${formula}`}>
          <span className="formula-icon" aria-hidden="true"><Sigma size={18} /></span>
          <span className="formula-label">Formula hint</span>
          {plainFormula ? (
            <span className="formula-plain">{plainFormula}</span>
          ) : (
            <BlockMath
              math={formula}
              renderError={() => <span className="formula-plain">Formula unavailable</span>}
            />
          )}
        </div>
      )}
    </div>
  )
}
