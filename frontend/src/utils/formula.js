export function normalizeLatex(value = '') {
  const withoutJsonBackspaces = value.split(String.fromCharCode(8)).join('\\b')
  return withoutJsonBackspaces
    .replace(/\t/g, '\\t')
    .replace(/\n(?=[A-Za-z])/g, '\\n')
    .replace(/\r(?=[A-Za-z])/g, '\\r')
    .replace(/\f(?=[A-Za-z])/g, '\\f')
    .replace(/^\s*\$\$?|\$\$?\s*$/g, '')
    .replace(/^\s*\\\[|\\\]\s*$/g, '')
    .trim()
}

export function toFormulaHint(value, questionText = '') {
  let hint = normalizeLatex(value)
  const namedValues = [...questionText.matchAll(/\b([A-Za-z][A-Za-z_-]*)\s*=\s*(-?\d+(?:\.\d+)?)/g)]

  for (const [, name, number] of namedValues) {
    hint = hint.replaceAll(number, `\\text{${name}}`)
  }

  if (namedValues.length && hint.includes('=')) {
    const sides = hint.split('=').map((part) => part.trim()).filter(Boolean)
    const expression = sides.find((side) => namedValues.some(([, name]) => side.includes(name)))
    if (expression) {
      const resultMatch = questionText.match(/(?:calculate|find|determine|compute|hitung)\s+(?:the\s+)?(.+?)(?:\s+for|\s+given|\s+when|\s+with|[,.?])/i)
      const resultName = resultMatch?.[1]?.replace(/[{}\\]/g, '').trim()
      return resultName ? `\\text{${resultName}} = ${expression}` : expression
    }
  }

  return hint
}

export function toPlainFormula(value = '') {
  const plain = value
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\s*([=×÷·±+])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim()

  return /[\\{}]/.test(plain) ? null : plain
}
