import { useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import './App.css'

const starterCode = `#include <iostream>
using namespace std;

int main() {
    int a = 10;
    int b = 20;
    int sum = a + b;

    cout << "The sum is: " << sum << endl;
    return 0;
}`


const codeExamples: Record<string, string> = {
  starter: starterCode,
  ifElse: `#include <iostream>
using namespace std;

int main() {
    int marks = 75;

    if (marks >= 50) {
        cout << "You passed!" << endl;
    } else {
        cout << "Try again!" << endl;
    }

    return 0;
}`,
  forLoop: `#include <iostream>
using namespace std;

int main() {
    int total = 0;

    for (int i = 1; i <= 5; i++) {
        total += i;
        cout << "i = " << i << ", total = " << total << endl;
    }

    return 0;
}`,
  whileLoop: `#include <iostream>
using namespace std;

int main() {
    int count = 1;

    while (count <= 3) {
        cout << "Count: " << count << endl;
        count++;
    }

    return 0;
}`,
}


type TraceValue = number | string

type VisualizerStep = {
  lineNumber: number
  line: string
  explanation: string
  variables: Record<string, TraceValue>
  output: string
}

type VisualizerResult = {
  steps: VisualizerStep[]
  unsupported: string[]
}

function evaluateArithmetic(expression: string, variables: Record<string, TraceValue>): number | undefined {
  const compact = expression.replace(/\s+/g, '')
  const tokens = expression.match(/[A-Za-z_]\w*|\d+(?:\.\d+)?|[()+\-*/%]/g) ?? []
  if (!tokens.length || tokens.join('') !== compact) return undefined

  let position = 0

  const parseExpression = (): number | undefined => {
    const parseFactor = (): number | undefined => {
      const token = tokens[position]
      if (token === undefined) return undefined
      position += 1

      if (token === '+') return parseFactor()
      if (token === '-') {
        const value = parseFactor()
        return value === undefined ? undefined : -value
      }
      if (token === '(') {
        const value = parseExpression()
        if (tokens[position] !== ')') return undefined
        position += 1
        return value
      }
      if (/^\d/.test(token)) return Number(token)
      const value = variables[token]
      return typeof value === 'number' ? value : undefined
    }

    const parseTerm = (): number | undefined => {
      let value = parseFactor()
      if (value === undefined) return undefined
      while (tokens[position] === '*' || tokens[position] === '/' || tokens[position] === '%') {
        const operator = tokens[position++]
        const right = parseFactor()
        if (right === undefined || ((operator === '/' || operator === '%') && right === 0)) return undefined
        if (operator === '*') value *= right
        if (operator === '/') value /= right
        if (operator === '%') value %= right
      }
      return value
    }

    let value = parseTerm()
    if (value === undefined) return undefined
    while (tokens[position] === '+' || tokens[position] === '-') {
      const operator = tokens[position++]
      const right = parseTerm()
      if (right === undefined) return undefined
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  const result = parseExpression()
  return position === tokens.length && result !== undefined && Number.isFinite(result) ? result : undefined
}

type TraceNode =
  | { kind: 'statement'; lineNumber: number; line: string }
  | { kind: 'if'; lineNumber: number; line: string; condition: string; body: TraceNode[]; elseBody: TraceNode[] }
  | { kind: 'for'; lineNumber: number; line: string; init: string; condition: string; update: string; body: TraceNode[] }
  | { kind: 'while'; lineNumber: number; line: string; condition: string; body: TraceNode[] }

type CodeToken = { text: string; lineNumber: number }

function tokenizeCppSubset(source: string): CodeToken[] {
  const tokens: CodeToken[] = []

  source.split(/\r?\n/).forEach((rawLine, lineIndex) => {
    let chunk = ''
    let parenDepth = 0
    let quote: string | null = null
    let escaped = false

    const emit = () => {
      const text = chunk.trim()
      if (text) tokens.push({ text, lineNumber: lineIndex + 1 })
      chunk = ''
    }

    for (let index = 0; index < rawLine.length; index += 1) {
      const char = rawLine[index]
      const next = rawLine[index + 1]

      if (!quote && char === '/' && next === '/') break

      if (quote) {
        chunk += char
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = null
        continue
      }

      if (char === '"' || char === "'") {
        quote = char
        chunk += char
        continue
      }

      if (char === '(') parenDepth += 1
      if (char === ')') parenDepth = Math.max(0, parenDepth - 1)

      if (parenDepth === 0 && (char === '{' || char === '}')) {
        emit()
        tokens.push({ text: char, lineNumber: lineIndex + 1 })
        continue
      }

      chunk += char
      if (char === ';' && parenDepth === 0) emit()
    }

    emit()
  })

  return tokens
}

function splitAtTopLevel(expression: string, operator: string): string[] {
  const pieces: string[] = []
  let depth = 0
  let start = 0

  for (let index = 0; index <= expression.length - operator.length; index += 1) {
    if (expression[index] === '(') depth += 1
    else if (expression[index] === ')') depth -= 1

    if (depth === 0 && expression.slice(index, index + operator.length) === operator) {
      pieces.push(expression.slice(start, index).trim())
      start = index + operator.length
      index += operator.length - 1
    }
  }

  if (pieces.length === 0) return [expression.trim()]
  pieces.push(expression.slice(start).trim())
  return pieces
}

function evaluateCondition(condition: string, variables: Record<string, TraceValue>): boolean | undefined {
  const expression = condition.trim()
  if (!expression) return undefined
  if (expression === 'true') return true
  if (expression === 'false') return false

  const orParts = splitAtTopLevel(expression, '||')
  if (orParts.length > 1) {
    const values = orParts.map((part) => evaluateCondition(part, variables))
    if (values.some((value) => value === true)) return true
    if (values.every((value) => value === false)) return false
    return undefined
  }

  const andParts = splitAtTopLevel(expression, '&&')
  if (andParts.length > 1) {
    const values = andParts.map((part) => evaluateCondition(part, variables))
    if (values.some((value) => value === false)) return false
    if (values.every((value) => value === true)) return true
    return undefined
  }

  if (expression.startsWith('!')) {
    const result = evaluateCondition(expression.slice(1), variables)
    return result === undefined ? undefined : !result
  }

  const comparison = expression.match(/^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/)
  if (comparison) {
    const left = evaluateArithmetic(comparison[1], variables)
    const right = evaluateArithmetic(comparison[3], variables)
    if (left === undefined || right === undefined) return undefined
    switch (comparison[2]) {
      case '>': return left > right
      case '<': return left < right
      case '>=': return left >= right
      case '<=': return left <= right
      case '==': return left === right
      case '!=': return left !== right
    }
  }

  const value = evaluateArithmetic(expression, variables)
  return value === undefined ? undefined : value !== 0
}

function buildTraceTree(source: string): { nodes: TraceNode[]; warnings: string[] } {
  const tokens = tokenizeCppSubset(source)
  const warnings: string[] = []
  let cursor = 0

  const parseSequence = (stopAtBrace: boolean): TraceNode[] => {
    const nodes: TraceNode[] = []

    while (cursor < tokens.length) {
      const token = tokens[cursor]
      if (token.text === '}') {
        cursor += 1
        if (stopAtBrace) break
        continue
      }
      if (token.text === '{') {
        cursor += 1
        nodes.push(...parseSequence(true))
        continue
      }

      const mainHeader = /^(?:(?:int|signed|unsigned)\s+)?main\s*\([^)]*\)$/.test(token.text)
      if (mainHeader) {
        cursor += 1
        if (tokens[cursor]?.text === '{') {
          cursor += 1
          nodes.push(...parseSequence(true))
        }
        continue
      }

      if (token.text === 'else') {
        warnings.push(`Line ${token.lineNumber}: An else branch could not be attached to its if statement.`)
        cursor += 1
        continue
      }

      const ifMatch = token.text.match(/^if\s*\((.*)\)$/)
      if (ifMatch) {
        cursor += 1
        const body = parseBody()
        let elseBody: TraceNode[] = []
        if (tokens[cursor]?.text === 'else') {
          cursor += 1
          if (tokens[cursor]?.text.match(/^if\s*\(/)) {
            const nested = parseOne()
            elseBody = nested ? [nested] : []
          } else {
            elseBody = parseBody()
          }
        }
        nodes.push({ kind: 'if', lineNumber: token.lineNumber, line: token.text, condition: ifMatch[1], body, elseBody })
        continue
      }

      const forMatch = token.text.match(/^for\s*\((.*)\)$/)
      if (forMatch) {
        cursor += 1
        const parts = forMatch[1].split(';')
        const body = parseBody()
        if (parts.length !== 3) {
          warnings.push(`Line ${token.lineNumber}: The visualizer expects a standard for(init; condition; update) loop.`)
          nodes.push({ kind: 'statement', lineNumber: token.lineNumber, line: token.text })
        } else {
          nodes.push({ kind: 'for', lineNumber: token.lineNumber, line: token.text, init: parts[0].trim(), condition: parts[1].trim(), update: parts[2].trim(), body })
        }
        continue
      }

      const whileMatch = token.text.match(/^while\s*\((.*)\)$/)
      if (whileMatch) {
        cursor += 1
        const body = parseBody()
        nodes.push({ kind: 'while', lineNumber: token.lineNumber, line: token.text, condition: whileMatch[1], body })
        continue
      }

      const node = parseOne()
      if (node) nodes.push(node)
    }

    return nodes
  }

  const parseBody = (): TraceNode[] => {
    if (tokens[cursor]?.text === '{') {
      cursor += 1
      return parseSequence(true)
    }
    const node = parseOne()
    return node ? [node] : []
  }

  const parseOne = (): TraceNode | null => {
    const token = tokens[cursor]
    if (!token) return null
    cursor += 1
    return { kind: 'statement', lineNumber: token.lineNumber, line: token.text }
  }

  return { nodes: parseSequence(false), warnings }
}

function createCodeTrace(source: string): VisualizerResult {
  const variables: Record<string, TraceValue> = {}
  const steps: VisualizerStep[] = [{
    lineNumber: 0,
    line: 'Program starts',
    explanation: 'Execution begins. No variables have been created yet.',
    variables: {},
    output: '',
  }]
  const unsupported: string[] = []
  let output = ''
  let stopped = false
  const maxSteps = 350
  const maxLoopIterations = 25

  const addStep = (lineNumber: number, line: string, explanation: string) => {
    if (steps.length >= maxSteps) {
      stopped = true
      if (!unsupported.includes('The visualizer stopped at its 350-step safety limit.')) {
        unsupported.push('The visualizer stopped at its 350-step safety limit.')
      }
      return
    }
    steps.push({ lineNumber, line: line.trim(), explanation, variables: { ...variables }, output })
  }

  const applyStatement = (rawLine: string, lineNumber: number): boolean => {
    const line = rawLine.trim()
    if (!line || line === '{' || line === '}') return true
    if (line.startsWith('#include') || line.startsWith('using namespace')) return true

    let match = line.match(/^(?:int|long long|long|short|float|double|auto)\s+([A-Za-z_]\w*)\s*=\s*(.+);$/)
    if (match) {
      const [, name, expression] = match
      const value = evaluateArithmetic(expression, variables)
      if (value === undefined) {
        unsupported.push(`Line ${lineNumber}: Could not evaluate ${expression.trim()}.`)
        addStep(lineNumber, rawLine, `The initializer for ${name} is not supported by this visualizer yet.`)
      } else {
        variables[name] = value
        addStep(lineNumber, rawLine, `${name} is created with the value ${value}. The expression ${expression.trim()} evaluates to ${value}.`)
      }
      return true
    }

    match = line.match(/^(?:int|long long|long|short|float|double|auto)\s+([A-Za-z_]\w*)\s*;$/)
    if (match) {
      const name = match[1]
      variables[name] = 'Uninitialized'
      addStep(lineNumber, rawLine, `${name} is declared without an initial value.`)
      return true
    }

    match = line.match(/^([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=|%=|=)\s*(.+);$/)
    if (match) {
      const [, name, operator, expression] = match
      const right = evaluateArithmetic(expression, variables)
      const left = variables[name]
      if (right === undefined || typeof left !== 'number') {
        unsupported.push(`Line ${lineNumber}: Assignment ${line} is not supported yet.`)
        addStep(lineNumber, rawLine, `The assignment to ${name} could not be evaluated.`)
      } else {
        let value = right
        if (operator === '+=') value = left + right
        if (operator === '-=') value = left - right
        if (operator === '*=') value = left * right
        if (operator === '/=') value = right === 0 ? left : left / right
        if (operator === '%=') value = right === 0 ? left : left % right
        variables[name] = value
        addStep(lineNumber, rawLine, `${name} is updated to ${value}.`)
      }
      return true
    }

    match = line.match(/^(\+\+|--)?([A-Za-z_]\w*)(\+\+|--);$/)
    if (match) {
      const name = match[2]
      const operation = match[1] || match[3]
      const current = variables[name]
      if (typeof current !== 'number') {
        unsupported.push(`Line ${lineNumber}: ${name} is not a numeric variable.`)
        addStep(lineNumber, rawLine, `${name} could not be incremented or decremented.`)
      } else {
        variables[name] = operation === '++' ? current + 1 : current - 1
        addStep(lineNumber, rawLine, `${name} changes from ${current} to ${variables[name]}.`)
      }
      return true
    }

    if (/^(?:std::)?cout\s*<<.*;$/.test(line)) {
      const stream = line.replace(/^(?:std::)?cout\s*/, '').replace(/;$/, '')
      const parts = stream.split('<<').map((part) => part.trim()).filter(Boolean)
      let explanation = 'The program sends information to the output.'
      let handled = true
      for (const part of parts) {
        if (part === 'endl' || part === "'\\n'") { output += '\n'; continue }
        const quoted = part.match(/^"(.*)"$/)
        if (quoted) { output += quoted[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"'); continue }
        const character = part.match(/^'(.)'$/)
        if (character) { output += character[1]; continue }
        if (Object.prototype.hasOwnProperty.call(variables, part)) {
          output += String(variables[part])
          explanation = `The value of ${part} (${variables[part]}) is added to the output.`
          continue
        }
        const value = evaluateArithmetic(part, variables)
        if (value !== undefined) { output += String(value); explanation = `${part} evaluates to ${value}, which is printed.`; continue }
        handled = false
        unsupported.push(`Line ${lineNumber}: Output expression ${part} is not supported yet.`)
      }
      addStep(lineNumber, rawLine, handled ? explanation : 'This output line contains an expression the visualizer cannot trace yet.')
      return true
    }

    if (/^return\b/.test(line)) {
      addStep(lineNumber, rawLine, 'The return statement ends the main function.')
      return false
    }

    if (/^(break|continue)\s*;?$/.test(line)) {
      unsupported.push(`Line ${lineNumber}: ${line} is not animated by this version yet.`)
      addStep(lineNumber, rawLine, 'break and continue are not traced yet. The compiler can still execute them correctly.')
      return true
    }

    unsupported.push(`Line ${lineNumber}: ${line} is not animated by this learning preview.`)
    addStep(lineNumber, rawLine, 'This statement is not supported by the visualizer yet. Use Run Code for actual C++ execution.')
    return true
  }

  const tree = buildTraceTree(source)
  unsupported.push(...tree.warnings)

  const executeNodes = (nodes: TraceNode[]) => {
    for (const node of nodes) {
      if (stopped) return
      if (node.kind === 'statement') {
        if (!applyStatement(node.line, node.lineNumber)) stopped = true
        continue
      }

      if (node.kind === 'if') {
        const result = evaluateCondition(node.condition, variables)
        if (result === undefined) {
          unsupported.push(`Line ${node.lineNumber}: Condition "${node.condition}" could not be evaluated.`)
          addStep(node.lineNumber, node.line, `The condition ${node.condition} is outside the supported subset.`)
        } else {
          addStep(node.lineNumber, node.line, `Condition ${node.condition} is ${result ? 'TRUE' : 'FALSE'}. ${result ? 'The IF block will execute.' : 'The IF block will be skipped.'}`)
          executeNodes(result ? node.body : node.elseBody)
        }
        continue
      }

      if (node.kind === 'for') {
        if (node.init) applyStatement(node.init.endsWith(';') ? node.init : `${node.init};`, node.lineNumber)
        let iteration = 0
        while (!stopped) {
          const result = node.condition ? evaluateCondition(node.condition, variables) : true
          if (result === undefined) {
            unsupported.push(`Line ${node.lineNumber}: FOR condition ${node.condition} could not be evaluated.`)
            addStep(node.lineNumber, node.line, 'The FOR loop condition could not be evaluated.')
            break
          }
          addStep(node.lineNumber, node.line, `FOR condition ${node.condition || 'true'} is ${result ? 'TRUE' : 'FALSE'}.${result ? ` Iteration ${iteration + 1} will execute.` : ' The loop is finished.'}`)
          if (!result) break
          if (iteration >= maxLoopIterations) {
            unsupported.push(`Line ${node.lineNumber}: FOR loop stopped after ${maxLoopIterations} iterations to keep the preview safe.`)
            addStep(node.lineNumber, node.line, `The visualizer reached its ${maxLoopIterations}-iteration safety limit.`)
            break
          }
          executeNodes(node.body)
          if (stopped) break
          if (node.update) applyStatement(`${node.update};`, node.lineNumber)
          iteration += 1
        }
        continue
      }

      if (node.kind === 'while') {
        let iteration = 0
        while (!stopped) {
          const result = evaluateCondition(node.condition, variables)
          if (result === undefined) {
            unsupported.push(`Line ${node.lineNumber}: WHILE condition ${node.condition} could not be evaluated.`)
            addStep(node.lineNumber, node.line, 'The WHILE loop condition could not be evaluated.')
            break
          }
          addStep(node.lineNumber, node.line, `WHILE condition ${node.condition} is ${result ? 'TRUE' : 'FALSE'}.${result ? ` Iteration ${iteration + 1} will execute.` : ' The loop is finished.'}`)
          if (!result) break
          if (iteration >= maxLoopIterations) {
            unsupported.push(`Line ${node.lineNumber}: WHILE loop stopped after ${maxLoopIterations} iterations to keep the preview safe.`)
            addStep(node.lineNumber, node.line, `The visualizer reached its ${maxLoopIterations}-iteration safety limit.`)
            break
          }
          executeNodes(node.body)
          if (stopped) break
          iteration += 1
        }
      }
    }
  }

  executeNodes(tree.nodes)
  return { steps, unsupported: [...new Set(unsupported)] }
}

type ArrayOperation = 'insert' | 'delete' | 'search' | 'traverse'

type ArrayFrame = {
  values: (number | null)[]
  activeIndex: number | null
  label: string
  message: string
}

function buildArrayFrames(
  values: number[],
  operation: ArrayOperation,
  index: number,
  target: number,
): { frames: ArrayFrame[]; finalValues: number[] } {
  const frames: ArrayFrame[] = [{
    values: [...values],
    activeIndex: null,
    label: 'START',
    message: `The array contains ${values.length} elements. Indexes begin at 0.`,
  }]

  const updated = [...values]

  if (operation === 'insert') {
    const working: (number | null)[] = [...values, null]
    for (let cursor = values.length - 1; cursor >= index; cursor -= 1) {
      working[cursor + 1] = values[cursor]
      frames.push({
        values: [...working],
        activeIndex: cursor + 1,
        label: 'SHIFT RIGHT',
        message: `Copy ${values[cursor]} from index ${cursor} to index ${cursor + 1} to make room.`,
      })
    }
    working[index] = target
    frames.push({
      values: [...working],
      activeIndex: index,
      label: 'INSERT',
      message: `Place ${target} at index ${index}. The array now has ${working.length} elements.`,
    })
    return { frames, finalValues: working.filter((item): item is number => item !== null) }
  }

  if (operation === 'delete') {
    frames.push({
      values: [...updated],
      activeIndex: index,
      label: 'DELETE',
      message: `Select ${updated[index]} at index ${index} for deletion.`,
    })
    for (let cursor = index; cursor < updated.length - 1; cursor += 1) {
      updated[cursor] = updated[cursor + 1]
      frames.push({
        values: [...updated],
        activeIndex: cursor,
        label: 'SHIFT LEFT',
        message: `Move ${updated[cursor]} from index ${cursor + 1} to index ${cursor}.`,
      })
    }
    updated.pop()
    frames.push({
      values: [...updated],
      activeIndex: index < updated.length ? index : null,
      label: 'COMPLETE',
      message: `Element deleted. The array now contains ${updated.length} elements.`,
    })
    return { frames, finalValues: updated }
  }

  if (operation === 'search') {
    let found = -1
    values.forEach((item, cursor) => {
      if (found !== -1) return
      const matched = item === target
      frames.push({
        values: [...values],
        activeIndex: cursor,
        label: matched ? 'FOUND' : 'COMPARE',
        message: `Compare index ${cursor}: ${item} ${matched ? 'matches' : 'does not match'} ${target}.`,
      })
      if (matched) found = cursor
    })
    if (found === -1) {
      frames.push({
        values: [...values],
        activeIndex: null,
        label: 'NOT FOUND',
        message: `${target} is not present in this array.`,
      })
    } else {
      frames.push({
        values: [...values],
        activeIndex: found,
        label: 'SEARCH COMPLETE',
        message: `Found ${target} at index ${found}.`,
      })
    }
    return { frames, finalValues: updated }
  }

  values.forEach((item, cursor) => {
    frames.push({
      values: [...values],
      activeIndex: cursor,
      label: 'TRAVERSE',
      message: `Visit index ${cursor}. Its value is ${item}.`,
    })
  })
  frames.push({
    values: [...values],
    activeIndex: null,
    label: 'COMPLETE',
    message: `Traversal complete. Visited all ${values.length} elements.`,
  })
  return { frames, finalValues: updated }
}


type LinearStructure = 'stack' | 'queue'
type LinearAction = 'push' | 'pop' | 'enqueue' | 'dequeue'

type LinearFrame = {
  values: number[]
  activeIndex: number | null
  label: string
  message: string
}

function makeLinearFrames(
  initial: number[],
  structure: LinearStructure,
  action: LinearAction,
  value: number,
): { frames: LinearFrame[]; finalValues: number[] } {
  const values = [...initial]
  const frames: LinearFrame[] = [{
    values: [...values],
    activeIndex: null,
    label: 'START',
    message: structure === 'stack'
      ? 'A stack follows LIFO: Last In, First Out.'
      : 'A queue follows FIFO: First In, First Out.',
  }]

  if (structure === 'stack') {
    if (action === 'push') {
      if (values.length >= 10) {
        frames.push({
          values,
          activeIndex: null,
          label: 'STACK FULL',
          message: 'This learning demo allows up to 10 stack elements.',
        })
        return { frames, finalValues: values }
      }
      frames.push({
        values: [...values],
        activeIndex: null,
        label: 'PUSH',
        message: `Place ${value} on the top of the stack.`,
      })
      values.push(value)
      frames.push({
        values: [...values],
        activeIndex: values.length - 1,
        label: 'PUSH COMPLETE',
        message: `${value} has been added at the top. The stack size is now ${values.length}.`,
      })
    } else {
      if (values.length === 0) {
        frames.push({
          values,
          activeIndex: null,
          label: 'STACK UNDERFLOW',
          message: 'The stack is empty, so there is no element to pop.',
        })
        return { frames, finalValues: values }
      }
      const topIndex = values.length - 1
      frames.push({
        values: [...values],
        activeIndex: topIndex,
        label: 'TOP ELEMENT',
        message: `${values[topIndex]} is at the top and will be removed.`,
      })
      const removed = values.pop()!
      frames.push({
        values: [...values],
        activeIndex: null,
        label: 'POP COMPLETE',
        message: `${removed} has been removed. The new stack size is ${values.length}.`,
      })
    }
    return { frames, finalValues: values }
  }

  if (action === 'enqueue') {
    if (values.length >= 10) {
      frames.push({
        values,
        activeIndex: null,
        label: 'QUEUE FULL',
        message: 'This learning demo allows up to 10 queue elements.',
      })
      return { frames, finalValues: values }
    }
    frames.push({
      values: [...values],
      activeIndex: null,
      label: 'ENQUEUE',
      message: `Add ${value} at the rear (back) of the queue.`,
    })
    values.push(value)
    frames.push({
      values: [...values],
      activeIndex: values.length - 1,
      label: 'ENQUEUE COMPLETE',
      message: `${value} has joined at the rear. The queue size is now ${values.length}.`,
    })
  } else {
    if (values.length === 0) {
      frames.push({
        values,
        activeIndex: null,
        label: 'QUEUE UNDERFLOW',
        message: 'The queue is empty, so there is no element to dequeue.',
      })
      return { frames, finalValues: values }
    }
    frames.push({
      values: [...values],
      activeIndex: 0,
      label: 'FRONT ELEMENT',
      message: `${values[0]} is at the front and will leave first.`,
    })
    const removed = values.shift()!
    frames.push({
      values: [...values],
      activeIndex: values.length ? 0 : null,
      label: 'DEQUEUE COMPLETE',
      message: `${removed} has been removed from the front. The queue size is now ${values.length}.`,
    })
  }

  return { frames, finalValues: values }
}


type LinkedListAction =
  | 'insertHead'
  | 'insertTail'
  | 'insertAt'
  | 'deleteHead'
  | 'deleteTail'
  | 'deleteAt'
  | 'search'
  | 'traverse'

type LinkedListFrame = {
  values: number[]
  activeIndex: number | null
  label: string
  message: string
}

function buildLinkedListFrames(
  initial: number[],
  action: LinkedListAction,
  index: number,
  target: number,
): { frames: LinkedListFrame[]; finalValues: number[] } {
  const values = [...initial]
  const frames: LinkedListFrame[] = [{
    values: [...values],
    activeIndex: null,
    label: 'HEAD',
    message: values.length
      ? `Head points to the first node (${values[0]}). Each node links to the next node.`
      : 'The linked list is empty. Head is NULL.',
  }]

  if (action === 'insertHead' || action === 'insertTail' || action === 'insertAt') {
    const insertIndex = action === 'insertHead' ? 0 : action === 'insertTail' ? values.length : index
    if (values.length >= 8) {
      frames.push({
        values: [...values],
        activeIndex: null,
        label: 'LIST LIMIT',
        message: 'This visual playground supports up to 8 nodes at a time.',
      })
      return { frames, finalValues: values }
    }

    frames.push({
      values: [...values],
      activeIndex: insertIndex < values.length ? insertIndex : null,
      label: 'FIND POSITION',
      message: action === 'insertHead'
        ? 'The new node will become the head of the linked list.'
        : action === 'insertTail'
          ? 'Traverse to the last node. Its next pointer will point to the new node.'
          : `Traverse from head to index ${insertIndex} to find the insertion position.`,
    })

    values.splice(insertIndex, 0, target)
    frames.push({
      values: [...values],
      activeIndex: insertIndex,
      label: 'LINK NODE',
      message: `Create a node containing ${target} and update the links so it sits at index ${insertIndex}.`,
    })
    frames.push({
      values: [...values],
      activeIndex: insertIndex,
      label: 'INSERT COMPLETE',
      message: `Node ${target} is now part of the linked list. The list has ${values.length} nodes.`,
    })
    return { frames, finalValues: values }
  }

  if (action === 'deleteHead' || action === 'deleteTail' || action === 'deleteAt') {
    if (values.length === 0) {
      frames.push({
        values: [],
        activeIndex: null,
        label: 'EMPTY LIST',
        message: 'There is no node to delete because the linked list is empty.',
      })
      return { frames, finalValues: values }
    }

    const deleteIndex = action === 'deleteHead' ? 0 : action === 'deleteTail' ? values.length - 1 : index
    frames.push({
      values: [...values],
      activeIndex: deleteIndex,
      label: 'FIND NODE',
      message: `Traverse to index ${deleteIndex}. The node contains ${values[deleteIndex]}.`,
    })

    const removed = values.splice(deleteIndex, 1)[0]
    frames.push({
      values: [...values],
      activeIndex: values.length
        ? Math.min(deleteIndex, values.length - 1)
        : null,
      label: 'UPDATE LINKS',
      message: `Remove node ${removed} and link its previous node to its next node. If it was the head, move head forward.`,
    })
    frames.push({
      values: [...values],
      activeIndex: null,
      label: 'DELETE COMPLETE',
      message: `Node ${removed} has been deleted. The list now has ${values.length} nodes.`,
    })
    return { frames, finalValues: values }
  }

  if (action === 'search') {
    let foundAt = -1
    values.forEach((value, cursor) => {
      if (foundAt !== -1) return
      const found = value === target
      frames.push({
        values: [...values],
        activeIndex: cursor,
        label: found ? 'NODE FOUND' : 'FOLLOW NEXT',
        message: `Visit node ${cursor} containing ${value}. ${found ? `It matches ${target}.` : `It does not match ${target}, so follow next.`}`,
      })
      if (found) foundAt = cursor
    })
    if (foundAt === -1) {
      frames.push({
        values: [...values],
        activeIndex: null,
        label: 'NOT FOUND',
        message: `${target} is not present in this linked list.`,
      })
    } else {
      frames.push({
        values: [...values],
        activeIndex: foundAt,
        label: 'SEARCH COMPLETE',
        message: `Found ${target} at node index ${foundAt}.`,
      })
    }
    return { frames, finalValues: values }
  }

  values.forEach((value, cursor) => {
    frames.push({
      values: [...values],
      activeIndex: cursor,
      label: 'TRAVERSE',
      message: `Visit node ${cursor}: data = ${value}. Then follow its next pointer.`,
    })
  })
  frames.push({
    values: [...values],
    activeIndex: null,
    label: 'NULL',
    message: 'Traversal reached NULL. The linked list has been fully visited.',
  })
  return { frames, finalValues: values }
}

const featureCards = [
  { icon: '🧠', number: '01', title: 'AI Code Teacher', text: 'Understand tricky code with friendly, step-by-step explanations.', tone: 'lavender' },
  { icon: '🎬', number: '02', title: 'Visual Code Steps', text: 'Follow variables and program logic as each line is explored.', tone: 'peach' },
  { icon: '🌳', number: '03', title: 'Data Structures Lab', text: 'Explore arrays, stacks, queues, linked lists and trees.', tone: 'mint' },
  { icon: '🐞', number: '04', title: 'Friendly Debugging', text: 'Learn what an error means and how to approach fixing it.', tone: 'blue' },
]

function App() {
  const [page, setPage] = useState<'home' | 'editor'>('home')
  const [code, setCode] = useState(starterCode)
  const [selectedExample, setSelectedExample] = useState('starter')
  const [activeTab, setActiveTab] = useState<'output' | 'help' | 'visualizer' | 'arrays' | 'linear' | 'linked'>('output')
  const [notice, setNotice] = useState('Your code is ready to edit.')
  const [language, setLanguage] = useState<'English' | 'Roman Urdu'>('English')
  const [copied, setCopied] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [stdin, setStdin] = useState('')
  const [execution, setExecution] = useState<null | {
    output: string
    cpuTime?: string
    memory?: string
  }>(null)

  const lines = useMemo(() => code.split('\n').length, [code])
  const words = useMemo(() => code.trim() ? code.trim().split(/\s+/).length : 0, [code])
  const [arrayValuesInput, setArrayValuesInput] = useState('10, 20, 30, 40, 50')
  const [arrayOperation, setArrayOperation] = useState<ArrayOperation>('traverse')
  const [arrayIndexInput, setArrayIndexInput] = useState('2')
  const [arrayValueInput, setArrayValueInput] = useState('99')
  const [arrayFrames, setArrayFrames] = useState<ArrayFrame[]>([{
    values: [10, 20, 30, 40, 50],
    activeIndex: null,
    label: 'START',
    message: 'Choose an operation and build an animation to explore this array.',
  }])
  const [arrayStep, setArrayStep] = useState(0)
  const [arrayError, setArrayError] = useState('')
  const [linearStructure, setLinearStructure] = useState<LinearStructure>('stack')
  const [linearAction, setLinearAction] = useState<LinearAction>('push')
  const [linearValuesInput, setLinearValuesInput] = useState('10, 20, 30')
  const [linearValueInput, setLinearValueInput] = useState('40')
  const [linearFrames, setLinearFrames] = useState<LinearFrame[]>([{
    values: [10, 20, 30],
    activeIndex: null,
    label: 'START',
    message: 'Choose Stack or Queue, select an operation, then build an animation.',
  }])
  const [linearStep, setLinearStep] = useState(0)
  const [linearError, setLinearError] = useState('')
  const [linkedValuesInput, setLinkedValuesInput] = useState('10, 20, 30, 40')
  const [linkedAction, setLinkedAction] = useState<LinkedListAction>('traverse')
  const [linkedIndexInput, setLinkedIndexInput] = useState('1')
  const [linkedValueInput, setLinkedValueInput] = useState('99')
  const [linkedFrames, setLinkedFrames] = useState<LinkedListFrame[]>([{
    values: [10, 20, 30, 40],
    activeIndex: null,
    label: 'HEAD',
    message: 'A linked list is made of nodes. Each node stores data and a pointer to the next node.',
  }])
  const [linkedStep, setLinkedStep] = useState(0)
  const [linkedError, setLinkedError] = useState('')
  const currentLinkedFrame = linkedFrames[Math.min(linkedStep, linkedFrames.length - 1)]
  const currentLinearFrame = linearFrames[Math.min(linearStep, linearFrames.length - 1)]
  const currentArrayFrame = arrayFrames[Math.min(arrayStep, arrayFrames.length - 1)]
  const [visualIndex, setVisualIndex] = useState(0)
  const visualTrace = useMemo(() => createCodeTrace(code), [code])
  const safeVisualIndex = Math.min(visualIndex, visualTrace.steps.length - 1)
  const currentVisualStep = visualTrace.steps[safeVisualIndex]

  const loadExample = (name: string) => {
    setSelectedExample(name)
    setCode(codeExamples[name] ?? starterCode)
    setExecution(null)
    setVisualIndex(0)
    setActiveTab('visualizer')
  }

  const openEditor = () => {
    setPage('editor')
    setNotice('Your code is ready to edit.')
  }

  const openVisualizer = () => {
    setVisualIndex(0)
    setActiveTab('visualizer')
  }

  const openLinkedList = () => {
    setActiveTab('linked')
    setLinkedError('')
  }

  const buildLinkedListAnimation = () => {
    setLinkedError('')
    const rawValues = linkedValuesInput.split(',').map((part) => part.trim()).filter(Boolean)
    if (rawValues.length > 8) {
      setLinkedError('For this visual demo, use up to 8 nodes.')
      return
    }

    const values = rawValues.map(Number)
    if (rawValues.length && values.some((value) => !Number.isFinite(value))) {
      setLinkedError('Enter valid numeric node values separated by commas.')
      return
    }

    const index = Number(linkedIndexInput)
    const target = Number(linkedValueInput)
    const indexedInsert = linkedAction === 'insertAt'
    const indexedDelete = linkedAction === 'deleteAt'

    if ((indexedInsert && (!Number.isInteger(index) || index < 0 || index > values.length)) ||
        (indexedDelete && (!Number.isInteger(index) || index < 0 || index >= values.length))) {
      setLinkedError(indexedInsert
        ? `Insert index must be between 0 and ${values.length}.`
        : `Delete index must be between 0 and ${values.length - 1}.`)
      return
    }

    if (['insertHead', 'insertTail', 'insertAt', 'search'].includes(linkedAction) && !Number.isFinite(target)) {
      setLinkedError('Enter a valid numeric value.')
      return
    }

    const result = buildLinkedListFrames(values, linkedAction, index, target)
    setLinkedFrames(result.frames)
    setLinkedStep(0)
    setLinkedValuesInput(result.finalValues.join(', '))
  }

  const openStackQueue = () => {
    setActiveTab('linear')
    setLinearError('')
  }

  const buildLinearAnimation = () => {
    setLinearError('')
    const rawValues = linearValuesInput.split(',').map((part) => part.trim()).filter(Boolean)
    if (rawValues.length > 10) {
      setLinearError('For this learning demo, use up to 10 elements.')
      return
    }

    const values = rawValues.map(Number)
    if (rawValues.length && values.some((value) => !Number.isFinite(value))) {
      setLinearError('Enter valid numeric values separated by commas.')
      return
    }

    const actionValue = Number(linearValueInput)
    if ((linearAction === 'push' || linearAction === 'enqueue') && !Number.isFinite(actionValue)) {
      setLinearError('Enter a valid number to add.')
      return
    }

    const result = makeLinearFrames(values, linearStructure, linearAction, actionValue)
    setLinearFrames(result.frames)
    setLinearStep(0)
    setLinearValuesInput(result.finalValues.join(', '))
  }

  const openArrayLab = () => {
    setActiveTab('arrays')
    setArrayError('')
  }

  const buildArrayAnimation = () => {
    setArrayError('')
    const rawValues = arrayValuesInput.split(',').map((part) => part.trim()).filter(Boolean)
    if (rawValues.length === 0) {
      setArrayError('Enter at least one array value, for example: 10, 20, 30.')
      return
    }
    if (rawValues.length > 12) {
      setArrayError('For this visual demo, use up to 12 array elements.')
      return
    }

    const values = rawValues.map(Number)
    if (values.some((value) => !Number.isFinite(value))) {
      setArrayError('Array values must be valid numbers separated by commas.')
      return
    }

    const index = Number(arrayIndexInput)
    const target = Number(arrayValueInput)

    if ((arrayOperation === 'insert' || arrayOperation === 'delete') &&
        (!Number.isInteger(index) || index < 0 || index > values.length ||
         (arrayOperation === 'delete' && index >= values.length))) {
      setArrayError(arrayOperation === 'insert'
        ? `Insert index must be between 0 and ${values.length}.`
        : `Delete index must be between 0 and ${values.length - 1}.`)
      return
    }
    if ((arrayOperation === 'insert' || arrayOperation === 'search') && !Number.isFinite(target)) {
      setArrayError('Enter a valid numeric value.')
      return
    }

    const result = buildArrayFrames(values, arrayOperation, index, target)
    setArrayFrames(result.frames)
    setArrayStep(0)
    if (arrayOperation === 'insert' || arrayOperation === 'delete') {
      setArrayValuesInput(result.finalValues.join(', '))
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setNotice('Code copied to clipboard.')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setNotice('Clipboard access was blocked. Select the code and copy it with Ctrl + C.')
    }
  }

  const resetCode = () => {
    setCode(starterCode)
    setSelectedExample('starter')
    setExecution(null)
    setVisualIndex(0)
    setNotice('Starter C++ example restored.')
  }

  const runCode = async () => {
    if (!code.trim()) {
      setNotice('Write some C++ code before running it.')
      setActiveTab('output')
      return
    }

    setIsRunning(true)
    setExecution(null)
    setActiveTab('output')
    setNotice('Sending your code to the C++ compiler...')

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, stdin }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || `Compiler request failed (${response.status}).`)
      }

      setExecution({
        output: typeof result.output === 'string' ? result.output : '',
        cpuTime: result.cpuTime,
        memory: result.memory,
      })
      setNotice('Program finished. See the result below.')
    } catch (error) {
      setExecution({
        output: error instanceof Error ? error.message : 'Could not run the program.',
      })
      setNotice('The program could not be executed.')
    } finally {
      setIsRunning(false)
    }
  }

  if (page === 'editor') {
    return (
      <div className="workspace-shell">
        <header className="workspace-topbar">
          <button className="workspace-brand" type="button" onClick={() => setPage('home')}>
            <span className="brand-mark"><span /></span>
            <span>CodeLens<span className="brand-ai">AI</span></span>
          </button>
          <div className="workspace-breadcrumb"><span>Workspace</span><b>/</b><strong>Untitled.cpp</strong></div>
          <div className="workspace-top-actions">
            <span className="saved-indicator"><i /> C++ sandbox</span>
            <button className="top-home-button" type="button" onClick={() => setPage('home')}>← Home</button>
          </div>
        </header>

        <div className="workspace-layout">
          <aside className="workspace-sidebar">
            <div className="side-label">WORKSPACE</div>
            <button className="side-link side-link-active" type="button"><span>⌘</span> Code Editor</button>
            <button className="side-link" type="button" onClick={() => setNotice('The AI Code Teacher will be connected in the next development phase.')}><span>✦</span> AI Code Teacher <em>SOON</em></button>
            <button className={`side-link ${activeTab === 'visualizer' ? 'side-link-active' : ''}`} type="button" onClick={openVisualizer}><span>◇</span> Code Visualizer</button>
            <button className={`side-link ${activeTab === 'arrays' ? 'side-link-active' : ''}`} type="button" onClick={openArrayLab}><span>♧</span> Array Lab</button>
            <button className={`side-link ${activeTab === 'linear' ? 'side-link-active' : ''}`} type="button" onClick={openStackQueue}><span>⇅</span> Stack &amp; Queue</button>
            <button className={`side-link ${activeTab === 'linked' ? 'side-link-active' : ''}`} type="button" onClick={openLinkedList}><span>↗</span> Linked List</button>
            <div className="sidebar-bottom">
              <div className="sidebar-tip-icon">💡</div>
              <strong>Little tip</strong>
              <p>Press the Tab key inside the editor to indent your C++ code.</p>
            </div>
          </aside>

          <main className="editor-main">
            <div className="editor-heading">
              <div>
                <div className="section-kicker">YOUR CODING SPACE</div>
                <h1>Let's write some <span>code.</span></h1>
                <p>A calm space to experiment, learn and build your programming skills.</p>
              </div>
              <div className="editor-heading-badge"><span>✦</span> Beginner friendly</div>
            </div>

            <section className="editor-card">
              <div className="editor-toolbar">
                <div className="file-tab"><span className="cpp-icon">C++</span> main.cpp <span className="file-dot" /></div>
                <div className="editor-toolbar-actions">
                  <button type="button" className="tool-button" onClick={resetCode}>↺ <span>Reset</span></button>
                  <button type="button" className="tool-button" onClick={copyCode}>{copied ? '✓' : '▢'} <span>{copied ? 'Copied' : 'Copy'}</span></button>
                  <select className="example-select" aria-label="Load a C++ example" value={selectedExample} onChange={(event) => loadExample(event.target.value)}>
                    <option value="starter">Examples</option>
                    <option value="ifElse">If / Else</option>
                    <option value="forLoop">For loop</option>
                    <option value="whileLoop">While loop</option>
                  </select>
                  <button type="button" className="visualize-button" onClick={openVisualizer}>◇ Visualize</button>
                  <button type="button" className="run-button" onClick={runCode} disabled={isRunning}>{isRunning ? '◌ Running...' : '▶ Run code'}</button>
                </div>
              </div>

              <div className="editor-meta"><span><i /> C++</span><span>UTF-8</span><span>Spaces: 4</span><span>{lines} lines</span></div>

              <div className="code-editor-body">
                <div className="monaco-container">
                  <Editor
                    height="100%"
                    language="cpp"
                    theme="vs-dark"
                    value={code}
                    onChange={(value) => setCode(value ?? '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: 'Cascadia Code, Consolas, monospace',
                      lineNumbers: 'on',
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      tabSize: 4,
                      insertSpaces: true,
                      wordWrap: 'off',
                      padding: { top: 14, bottom: 14 },
                      cursorBlinking: 'smooth',
                      smoothScrolling: true,
                      bracketPairColorization: { enabled: true },
                      guides: { bracketPairs: true, indentation: true },
                      suggestOnTriggerCharacters: true,
                    }}
                  />
                </div>
              </div>

              <div className="editor-statusbar"><span>● Ready</span><span>{words} words</span><span>Ln {lines}, Col 1</span></div>
            </section>

            <section className="stdin-card">
              <div className="stdin-heading">
                <div><strong>Program input</strong><span>Optional · Used when your code reads with cin</span></div>
                <span className="stdin-tag">STDIN</span>
              </div>
              <textarea
                className="stdin-input"
                value={stdin}
                onChange={(event) => setStdin(event.target.value)}
                placeholder="Example: enter 2 numbers on separate lines"
                rows={2}
                aria-label="Program input"
              />
            </section>

            <section className="output-card">
              <div className="output-tabs">
                <button type="button" className={activeTab === 'output' ? 'output-tab active' : 'output-tab'} onClick={() => setActiveTab('output')}>▣ Output</button>
                <button type="button" className={activeTab === 'help' ? 'output-tab active' : 'output-tab'} onClick={() => setActiveTab('help')}>✦ Code overview</button>
                <button type="button" className={activeTab === 'visualizer' ? 'output-tab active' : 'output-tab'} onClick={openVisualizer}>◇ Visualizer</button>
                <button type="button" className={activeTab === 'arrays' ? 'output-tab active' : 'output-tab'} onClick={openArrayLab}>▦ Array Lab</button>
                <button type="button" className={activeTab === 'linear' ? 'output-tab active' : 'output-tab'} onClick={openStackQueue}>⇅ Stack &amp; Queue</button>
                <button type="button" className={activeTab === 'linked' ? 'output-tab active' : 'output-tab'} onClick={openLinkedList}>↗ Linked List</button>
                <span className="output-coming">JDoodle C++ compiler</span>
              </div>
              {activeTab === 'output' ? (
                execution ? (
                  <div className="execution-result">
                    <div className="execution-result-heading">
                      <strong><i /> Program result</strong>
                      <div className="execution-metrics">
                        {execution.cpuTime && <span>CPU {execution.cpuTime}s</span>}
                        {execution.memory && <span>{execution.memory} KB</span>}
                      </div>
                    </div>
                    <pre className="execution-output">{execution.output || '(Program finished without printed output.)'}</pre>
                  </div>
                ) : (
                  <div className="output-content">
                    <div className="terminal-icon">›_</div>
                    <div><strong>{isRunning ? 'Running your program...' : 'Ready when you are.'}</strong><p>{notice}</p></div>
                  </div>
                )
              ) : activeTab === 'help' ? (
                <div className="overview-content">
                  <div><strong>{lines}</strong><span>Lines of code</span></div>
                  <div><strong>{words}</strong><span>Words / tokens</span></div>
                  <div><strong>{(code.match(/\bint\b/g) || []).length}</strong><span>Integer declarations</span></div>
                  <p>This overview counts lines, words and integer declarations in your current code.</p>
                </div>
              ) : activeTab === 'visualizer' ? (
                <div className="visualizer-panel">
                  <div className="visualizer-heading">
                    <div>
                      <strong>Program walkthrough</strong>
                      <p>Explore variables, conditions and beginner loops one step at a time.</p>
                    </div>
                    <span className="visualizer-count">STEP {safeVisualIndex + 1} / {visualTrace.steps.length}</span>
                  </div>
                  <div className="visualizer-progress"><span style={{ width: `${((safeVisualIndex + 1) / visualTrace.steps.length) * 100}%` }} /></div>
                  <div className="visualizer-current">
                    <div className="visualizer-line-tag">{currentVisualStep.lineNumber === 0 ? 'START' : `LINE ${currentVisualStep.lineNumber}`}</div>
                    <code>{currentVisualStep.line}</code>
                    <p>{currentVisualStep.explanation}</p>
                  </div>
                  <div className="visualizer-section-title">MEMORY / VARIABLES</div>
                  <div className="visualizer-memory">
                    {Object.keys(currentVisualStep.variables).length ? Object.entries(currentVisualStep.variables).map(([name, value], index) => (
                      <div className={`visual-variable variable-${index % 4}`} key={name}>
                        <span>{name}</span><strong>{value}</strong><small>value</small>
                      </div>
                    )) : <div className="visualizer-empty">No variables created yet. Move to the next step.</div>}
                  </div>
                  <div className="visualizer-output">
                    <span>PROGRAM OUTPUT</span>
                    <pre>{currentVisualStep.output || 'Output is empty so far.'}</pre>
                  </div>
                  {visualTrace.unsupported.length > 0 && (
                    <div className="visualizer-warning">
                      <strong>Some lines are not animated yet</strong>
                      <p>This learning preview supports numeric variables, basic arithmetic, assignments, if/else, simple for/while loops and cout. Arrays, cin, functions, break/continue and pointers are not traced yet. Use Run Code for full C++ execution.</p>
                    </div>
                  )}
                  <div className="visualizer-controls">
                    <button type="button" onClick={() => setVisualIndex(0)} disabled={safeVisualIndex === 0}>↺ Restart</button>
                    <div>
                      <button type="button" onClick={() => setVisualIndex((value) => Math.max(0, value - 1))} disabled={safeVisualIndex === 0}>← Previous</button>
                      <button className="visualizer-next" type="button" onClick={() => setVisualIndex((value) => Math.min(visualTrace.steps.length - 1, value + 1))} disabled={safeVisualIndex >= visualTrace.steps.length - 1}>Next step →</button>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'arrays' ? (
                <div className="array-lab-panel">
                  <div className="array-lab-heading">
                    <div>
                      <div className="array-lab-kicker">DATA STRUCTURES LAB</div>
                      <strong>Array Playground</strong>
                      <p>Explore how elements move when you insert, delete, search or traverse an array.</p>
                    </div>
                    <span className="array-lab-badge">1D ARRAY</span>
                  </div>

                  <div className="array-lab-form">
                    <label className="array-field array-values-field">
                      <span>Array values</span>
                      <input value={arrayValuesInput} onChange={(event) => setArrayValuesInput(event.target.value)} placeholder="10, 20, 30, 40, 50" />
                    </label>
                    <label className="array-field">
                      <span>Operation</span>
                      <select value={arrayOperation} onChange={(event) => setArrayOperation(event.target.value as ArrayOperation)}>
                        <option value="traverse">Traverse</option>
                        <option value="insert">Insert</option>
                        <option value="delete">Delete</option>
                        <option value="search">Search</option>
                      </select>
                    </label>
                    {(arrayOperation === 'insert' || arrayOperation === 'delete') && (
                      <label className="array-field array-small-field">
                        <span>Index</span>
                        <input type="number" min="0" value={arrayIndexInput} onChange={(event) => setArrayIndexInput(event.target.value)} />
                      </label>
                    )}
                    {(arrayOperation === 'insert' || arrayOperation === 'search') && (
                      <label className="array-field array-small-field">
                        <span>{arrayOperation === 'insert' ? 'Value to insert' : 'Value to search'}</span>
                        <input type="number" value={arrayValueInput} onChange={(event) => setArrayValueInput(event.target.value)} />
                      </label>
                    )}
                    <button className="array-build-button" type="button" onClick={buildArrayAnimation}>Build animation <span>→</span></button>
                  </div>

                  {arrayError && <div className="array-error" role="alert">{arrayError}</div>}

                  <div className="array-stage">
                    <div className="array-stage-top">
                      <span>{currentArrayFrame.label}</span>
                      <strong>STEP {arrayStep + 1} / {arrayFrames.length}</strong>
                    </div>
                    <div className="array-progress"><span style={{ width: `${((arrayStep + 1) / arrayFrames.length) * 100}%` }} /></div>
                    <div className="array-cells">
                      {currentArrayFrame.values.map((value, index) => (
                        <div className={`array-cell ${currentArrayFrame.activeIndex === index ? 'array-cell-active' : ''} ${value === null ? 'array-cell-empty' : ''}`} key={`${index}-${value ?? 'empty'}`}>
                          <span className="array-cell-index">index {index}</span>
                          <strong>{value === null ? '·' : value}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="array-stage-message">
                      <span>✦</span>
                      <p>{currentArrayFrame.message}</p>
                    </div>
                    <div className="array-lab-controls">
                      <button type="button" onClick={() => setArrayStep(0)} disabled={arrayStep === 0}>↺ Restart</button>
                      <div>
                        <button type="button" onClick={() => setArrayStep((step) => Math.max(0, step - 1))} disabled={arrayStep === 0}>← Previous</button>
                        <button className="array-next-button" type="button" onClick={() => setArrayStep((step) => Math.min(arrayFrames.length - 1, step + 1))} disabled={arrayStep >= arrayFrames.length - 1}>Next step →</button>
                      </div>
                    </div>
                  </div>
                  <div className="array-lab-footnote">
                    <strong>Learning note</strong>
                    <span>Array indexes start at 0. Insert and delete shift elements, while search and traversal visit elements one by one.</span>
                  </div>
                </div>
              ) : activeTab === 'linear' ? (
                <div className="linear-lab-panel">
                  <div className="linear-lab-heading">
                    <div>
                      <div className="linear-lab-kicker">DATA STRUCTURES LAB</div>
                      <strong>Stack &amp; Queue Playground</strong>
                      <p>See how elements enter and leave two important linear data structures.</p>
                    </div>
                    <span className="linear-lab-badge">{linearStructure === 'stack' ? 'LIFO' : 'FIFO'}</span>
                  </div>

                  <div className="linear-configuration">
                    <label className="linear-field">
                      <span>Structure</span>
                      <select value={linearStructure} onChange={(event) => {
                        const next = event.target.value as LinearStructure
                        setLinearStructure(next)
                        setLinearAction(next === 'stack' ? 'push' : 'enqueue')
                        setLinearError('')
                      }}>
                        <option value="stack">Stack</option>
                        <option value="queue">Queue</option>
                      </select>
                    </label>
                    <label className="linear-field">
                      <span>Operation</span>
                      <select value={linearAction} onChange={(event) => setLinearAction(event.target.value as LinearAction)}>
                        {linearStructure === 'stack' ? (
                          <>
                            <option value="push">Push</option>
                            <option value="pop">Pop</option>
                          </>
                        ) : (
                          <>
                            <option value="enqueue">Enqueue</option>
                            <option value="dequeue">Dequeue</option>
                          </>
                        )}
                      </select>
                    </label>
                    <label className="linear-field linear-values-field">
                      <span>Starting elements (comma separated)</span>
                      <input value={linearValuesInput} onChange={(event) => setLinearValuesInput(event.target.value)} placeholder="10, 20, 30" />
                    </label>
                    {(linearAction === 'push' || linearAction === 'enqueue') && (
                      <label className="linear-field linear-value-field">
                        <span>Value to add</span>
                        <input type="number" value={linearValueInput} onChange={(event) => setLinearValueInput(event.target.value)} />
                      </label>
                    )}
                    <button className="linear-build-button" type="button" onClick={buildLinearAnimation}>Build animation <span>→</span></button>
                  </div>

                  {linearError && <div className="linear-error" role="alert">{linearError}</div>}

                  <div className={`linear-stage ${linearStructure === 'stack' ? 'stack-stage' : 'queue-stage'}`}>
                    <div className="linear-stage-top">
                      <span>{currentLinearFrame.label}</span>
                      <strong>STEP {linearStep + 1} / {linearFrames.length}</strong>
                    </div>
                    <div className="linear-progress"><span style={{ width: `${((linearStep + 1) / linearFrames.length) * 100}%` }} /></div>
                    <div className="linear-end-labels">
                      {linearStructure === 'stack' ? (
                        <>
                          <span>TOP ↓</span>
                          <span>BASE</span>
                        </>
                      ) : (
                        <>
                          <span>FRONT ←</span>
                          <span>REAR →</span>
                        </>
                      )}
                    </div>
                    <div className={`linear-cells ${linearStructure === 'stack' ? 'linear-cells-stack' : 'linear-cells-queue'}`}>
                      {currentLinearFrame.values.map((value, index) => (
                        <div
                          key={`${index}-${value}`}
                          className={`linear-cell ${currentLinearFrame.activeIndex === index ? 'linear-cell-active' : ''}`}
                        >
                          <strong>{value}</strong>
                          <small>{linearStructure === 'stack' ? (index === currentLinearFrame.values.length - 1 ? 'TOP' : `#${index + 1}`) : (index === 0 ? 'FRONT' : index === currentLinearFrame.values.length - 1 ? 'REAR' : `#${index + 1}`)}</small>
                        </div>
                      ))}
                      {currentLinearFrame.values.length === 0 && (
                        <div className="linear-empty">Empty {linearStructure}</div>
                      )}
                    </div>
                    <div className="linear-stage-message">
                      <span>✦</span><p>{currentLinearFrame.message}</p>
                    </div>
                    <div className="linear-controls">
                      <button type="button" disabled={linearStep === 0} onClick={() => setLinearStep(0)}>↺ Restart</button>
                      <div>
                        <button type="button" disabled={linearStep === 0} onClick={() => setLinearStep((step) => Math.max(0, step - 1))}>← Previous</button>
                        <button className="linear-next-button" type="button" disabled={linearStep >= linearFrames.length - 1} onClick={() => setLinearStep((step) => Math.min(linearFrames.length - 1, step + 1))}>Next step →</button>
                      </div>
                    </div>
                  </div>

                  <div className="linear-comparison">
                    <div><strong>Stack · LIFO</strong><span>Last In, First Out. Push and Pop happen at the top.</span></div>
                    <div><strong>Queue · FIFO</strong><span>First In, First Out. Enqueue at the rear, Dequeue from the front.</span></div>
                  </div>
                </div>
              ) : (
                <div className="linked-lab-panel">
                  <div className="linked-lab-heading">
                    <div>
                      <div className="linked-lab-kicker">DATA STRUCTURES LAB</div>
                      <strong>Singly Linked List Playground</strong>
                      <p>See how nodes connect through next pointers, and how links change during operations.</p>
                    </div>
                    <span className="linked-lab-badge">HEAD → NULL</span>
                  </div>

                  <div className="linked-configuration">
                    <label className="linked-field linked-values-field">
                      <span>Starting node values</span>
                      <input value={linkedValuesInput} onChange={(event) => setLinkedValuesInput(event.target.value)} placeholder="10, 20, 30, 40" />
                    </label>
                    <label className="linked-field">
                      <span>Operation</span>
                      <select value={linkedAction} onChange={(event) => setLinkedAction(event.target.value as LinkedListAction)}>
                        <option value="traverse">Traverse</option>
                        <option value="search">Search</option>
                        <option value="insertHead">Insert at head</option>
                        <option value="insertTail">Insert at tail</option>
                        <option value="insertAt">Insert at index</option>
                        <option value="deleteHead">Delete head</option>
                        <option value="deleteTail">Delete tail</option>
                        <option value="deleteAt">Delete at index</option>
                      </select>
                    </label>
                    {(linkedAction === 'insertAt' || linkedAction === 'deleteAt') && (
                      <label className="linked-field linked-small-field">
                        <span>Index</span>
                        <input type="number" min="0" value={linkedIndexInput} onChange={(event) => setLinkedIndexInput(event.target.value)} />
                      </label>
                    )}
                    {['insertHead', 'insertTail', 'insertAt', 'search'].includes(linkedAction) && (
                      <label className="linked-field linked-small-field">
                        <span>{linkedAction === 'search' ? 'Search value' : 'New node value'}</span>
                        <input type="number" value={linkedValueInput} onChange={(event) => setLinkedValueInput(event.target.value)} />
                      </label>
                    )}
                    <button className="linked-build-button" type="button" onClick={buildLinkedListAnimation}>Build animation <span>→</span></button>
                  </div>

                  {linkedError && <div className="linked-error" role="alert">{linkedError}</div>}

                  <div className="linked-stage">
                    <div className="linked-stage-top">
                      <span>{currentLinkedFrame.label}</span>
                      <strong>STEP {linkedStep + 1} / {linkedFrames.length}</strong>
                    </div>
                    <div className="linked-progress"><span style={{ width: `${((linkedStep + 1) / linkedFrames.length) * 100}%` }} /></div>
                    <div className="linked-flow-labels"><span>HEAD</span><span>TAIL</span></div>
                    <div className="linked-nodes">
                      {currentLinkedFrame.values.map((value, index) => (
                        <div className="linked-node-group" key={`${index}-${value}`}>
                          <div className={`linked-node ${currentLinkedFrame.activeIndex === index ? 'linked-node-active' : ''}`}>
                            <div className="linked-node-value">{value}</div>
                            <div className="linked-node-next">next <span>↗</span></div>
                            <small>Node {index}</small>
                          </div>
                          {index < currentLinkedFrame.values.length - 1 && <div className="linked-arrow">→</div>}
                        </div>
                      ))}
                      <div className="linked-null">NULL</div>
                      {currentLinkedFrame.values.length === 0 && <div className="linked-empty">HEAD → NULL (empty list)</div>}
                    </div>
                    <div className="linked-stage-message"><span>✦</span><p>{currentLinkedFrame.message}</p></div>
                    <div className="linked-controls">
                      <button type="button" disabled={linkedStep === 0} onClick={() => setLinkedStep(0)}>↺ Restart</button>
                      <div>
                        <button type="button" disabled={linkedStep === 0} onClick={() => setLinkedStep((step) => Math.max(0, step - 1))}>← Previous</button>
                        <button className="linked-next-button" type="button" disabled={linkedStep >= linkedFrames.length - 1} onClick={() => setLinkedStep((step) => Math.min(linkedFrames.length - 1, step + 1))}>Next step →</button>
                      </div>
                    </div>
                  </div>

                  <div className="linked-learning-note">
                    <strong>How a node works</strong>
                    <span>Each node stores data and a next pointer. The last node points to NULL. Unlike an array, linked-list nodes do not need to sit next to each other in memory.</span>
                  </div>
                </div>
              )}
            </section>

            <div className="editor-note"><span>🔒</span> Code is sent to the remote compiler only when you press Run. Account-based project saving will be added later.</div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <button className="brand brand-button" type="button" onClick={() => setPage('home')}>
          <span className="brand-mark"><span /></span><span className="brand-name">CodeLens<span>AI</span></span>
        </button>
        <nav className="nav-links" aria-label="Main navigation">
          <a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#demo">Try a demo</a>
        </nav>
        <button className="top-cta" type="button" onClick={openEditor}>Open Code Editor <span>↗</span></button>
      </header>

      <main id="home">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> A clearer way to learn programming</div>
            <h1>See the logic.<br /><span>Not just the code.</span></h1>
            <p className="hero-description">Meet your friendly AI programming companion. Understand code line by line, watch logic come alive, and make tricky topics feel simple.</p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={openEditor}>Open Code Editor <span>→</span></button>
              <a className="secondary-button" href="#features">Discover features <span>↓</span></a>
            </div>
            <div className="hero-proof"><div className="avatar-stack"><span>👩🏻‍💻</span><span>🧑🏽‍🎓</span><span>👨🏼‍💻</span></div><div><strong>Learn at your own pace</strong><small>Built for curious minds and new coders</small></div></div>
          </div>
          <div className="hero-art">
            <div className="float-chip chip-top"><span>✦</span> Learn visually</div>
            <div className="code-window">
              <div className="window-top"><div className="window-dots"><i /><i /><i /></div><span className="file-label"><span className="cpp-badge">C++</span> sum.cpp</span><span className="window-status"><b /> Ready</span></div>
              <div className="code-content">
                <div className="code-lines"><div><em>01</em><span className="code-purple">int</span> <span className="code-white">a</span> = <span className="code-orange">10</span>;</div><div><em>02</em><span className="code-purple">int</span> <span className="code-white">b</span> = <span className="code-orange">20</span>;</div><div className="active-code-line"><em>03</em><span className="code-purple">int</span> <span className="code-white">sum</span> = a + b;</div><div><em>04</em><span className="code-pink">cout</span> &lt;&lt; sum;</div></div>
                <div className="visual-divider"><span>↓</span><small>MEMORY VIEW</small><span>↓</span></div>
                <div className="memory-cards"><div className="memory-card memory-a"><small>int a</small><strong>10</strong></div><div className="memory-card memory-b"><small>int b</small><strong>20</strong></div><div className="memory-card memory-sum"><small>int sum</small><strong>30</strong></div></div>
              </div>
              <div className="window-bottom"><span><i /> Program explained</span><span>Step 03 / 04</span></div>
            </div>
            <div className="float-chip chip-bottom"><span>✦</span> From confusion to clarity</div><div className="art-spark spark-one">✳</div><div className="art-spark spark-two">✦</div>
          </div>
        </section>

        <section className="trust-strip section-wrap"><span>MADE FOR THE WAY YOU LEARN</span><div><b>01</b> Understand concepts</div><div><b>02</b> Visualize the steps</div><div><b>03</b> Practice with confidence</div></section>

        <section className="features-section section-wrap" id="features">
          <div className="section-heading"><div><div className="section-kicker">YOUR LEARNING TOOLKIT</div><h2>Big concepts. <span>Made simple.</span></h2></div><p>Everything you need to move from “I don't get it” to “Oh, now I see!”</p></div>
          <div className="feature-grid">{featureCards.map((feature) => <article className={`feature-card ${feature.tone}`} key={feature.number}><div className="feature-card-top"><span className="feature-icon">{feature.icon}</span><span className="feature-number">{feature.number}</span></div><h3>{feature.title}</h3><p>{feature.text}</p><span className="feature-arrow">↗</span></article>)}</div>
        </section>

        <section className="demo-section section-wrap" id="demo">
          <div className="demo-copy"><div className="section-kicker">A LITTLE PREVIEW</div><h2>Code goes in.<br /><span>Clarity comes out.</span></h2><p>Open your coding workspace to edit a C++ example. We'll add AI explanations and code execution in the next phases.</p><button className="primary-button" type="button" onClick={openEditor}>Try the code editor <span>→</span></button></div>
          <div className="demo-panel"><div className="demo-panel-header"><span><i /> INTERACTIVE CODE PREVIEW</span><span className="demo-lang">C++</span></div><div className="demo-code"><div className="demo-code-line"><span className="line-number">01</span><code>int a = 10;</code></div><div className="demo-code-line"><span className="line-number">02</span><code>int b = 20;</code></div><div className="demo-code-line selected"><span className="line-number">03</span><code>int sum = a + b;</code><span className="line-marker">●</span></div><div className="demo-code-line"><span className="line-number">04</span><code>cout &lt;&lt; sum;</code></div></div><div className="explanation-box"><div className="explanation-heading"><span>✦</span> EXAMPLE MEMORY VIEW</div><div className="memory-cards"><div className="memory-card memory-a"><small>a</small><strong>10</strong></div><div className="memory-card memory-b"><small>b</small><strong>20</strong></div><div className="memory-card memory-sum"><small>sum</small><strong>30</strong></div></div></div></div>
        </section>

        <section className="how-section section-wrap" id="how-it-works"><div className="center-heading"><div className="section-kicker">YOUR NEXT STEP STARTS HERE</div><h2>Learn in <span>three simple steps.</span></h2></div><div className="how-grid"><div className="how-card"><div className="how-icon icon-one">⌨️</div><span>STEP 01</span><h3>Bring your code</h3><p>Write a snippet or choose a beginner-friendly example.</p></div><div className="how-card"><div className="how-icon icon-two">✨</div><span>STEP 02</span><h3>Let it make sense</h3><p>Explore a clear explanation and follow the logic visually.</p></div><div className="how-card"><div className="how-icon icon-three">🚀</div><span>STEP 03</span><h3>Practice and grow</h3><p>Try a new example, ask questions and build confidence.</p></div></div></section>

        <section className="final-cta section-wrap"><div className="cta-decoration">✳</div><div><div className="section-kicker">READY WHEN YOU ARE</div><h2>Make code click.</h2><p>Your programming journey deserves a clearer view.</p></div><button className="primary-button cta-button" type="button" onClick={openEditor}>Open your workspace <span>→</span></button></section>
      </main>

      <footer className="footer section-wrap"><button className="brand brand-button" type="button" onClick={() => setPage('home')}><span className="brand-mark"><span /></span><span className="brand-name">CodeLens<span>AI</span></span></button><p>Understand code. Visualize logic. Keep growing.</p><span>© 2026 CodeLens AI · Learning, made clearer.</span></footer>
    </div>
  )
}

export default App
