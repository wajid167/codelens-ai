import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import Editor from '@monaco-editor/react'
import { supabase, supabaseConfigured } from './lib/supabase'
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


type TeacherMessage = { role: 'user' | 'assistant'; content: string }

type QuizTopic = 'All topics' | 'C++ Basics' | 'Control Flow' | 'Data Structures'
type QuizQuestion = {
  id: string
  topic: Exclude<QuizTopic, 'All topics'>
  question: string
  options: string[]
  correct: number
  explanation: string
}

const quizQuestions: QuizQuestion[] = [
  { id: 'basics-1', topic: 'C++ Basics', question: 'Which line correctly declares an integer variable named score with the value 10?', options: ['int score = 10;', 'score int = 10;', 'integer score(10);', 'num score = 10;'], correct: 0, explanation: '`int` is the built-in integer type. The variable name follows the type, and `= 10` initializes it.' },
  { id: 'basics-2', topic: 'C++ Basics', question: 'Which operator sends a value to std::cout?', options: ['>>', '<<', '==', '&&'], correct: 1, explanation: 'The insertion operator `<<` sends output to `cout`, for example: `cout << score;`.' },
  { id: 'basics-3', topic: 'C++ Basics', question: 'Which value can a bool variable store?', options: ['Only decimal numbers', 'A single character', 'true or false', 'A whole sentence'], correct: 2, explanation: 'A `bool` stores one of two logical values: `true` or `false`.' },
  { id: 'basics-4', topic: 'C++ Basics', question: 'What is the index of the first element in a C++ array?', options: ['1', '-1', 'It depends on the array size', '0'], correct: 3, explanation: 'C++ arrays use zero-based indexing, so the first element is at index `0`.' },
  { id: 'basics-5', topic: 'C++ Basics', question: 'Which is a valid character literal in C++?', options: ['"A"', "'A'", '`A`', '{A}'], correct: 1, explanation: 'A character literal is written in single quotation marks, such as `char grade = \'A\';`. Double quotes create a string literal.' },
  { id: 'flow-1', topic: 'Control Flow', question: 'How many times does this loop run?  for (int i = 1; i <= 3; i++)', options: ['2 times', '3 times', '4 times', 'Forever'], correct: 1, explanation: 'The values of `i` are 1, 2, and 3. After the third iteration, `i` becomes 4 and the condition is false.' },
  { id: 'flow-2', topic: 'Control Flow', question: 'When is a while-loop condition checked?', options: ['Before each iteration', 'Only after the loop ends', 'Only once at the start', 'After every two iterations'], correct: 0, explanation: 'A `while` condition is checked before the body each time. If it is false at the start, the body does not run.' },
  { id: 'flow-3', topic: 'Control Flow', question: 'What does break do inside a loop?', options: ['Skips only the current iteration', 'Restarts the loop', 'Exits the nearest loop', 'Pauses the program'], correct: 2, explanation: '`break` immediately exits the nearest enclosing loop (or switch statement). `continue` skips to the next iteration.' },
  { id: 'flow-4', topic: 'Control Flow', question: 'What does continue do inside a loop?', options: ['Ends the whole program', 'Skips the rest of the current iteration', 'Exits every nested loop', 'Repeats the same statement forever'], correct: 1, explanation: '`continue` skips the remaining statements in the current iteration and proceeds with the next iteration.' },
  { id: 'flow-5', topic: 'Control Flow', question: 'What is special about a do-while loop?', options: ['It never checks a condition', 'It can only run once', 'It is used only with arrays', 'Its body runs at least once'], correct: 3, explanation: 'A `do-while` loop checks its condition after the body, so the body executes at least once.' },
  { id: 'ds-1', topic: 'Data Structures', question: 'Which rule does a stack follow?', options: ['FIFO — First In, First Out', 'LIFO — Last In, First Out', 'Random access only', 'Smallest value first'], correct: 1, explanation: 'A stack follows LIFO: the most recently pushed item is the first one popped.' },
  { id: 'ds-2', topic: 'Data Structures', question: 'Which rule does a queue follow?', options: ['LIFO — Last In, First Out', 'Largest value first', 'FIFO — First In, First Out', 'Alphabetical order'], correct: 2, explanation: 'A queue follows FIFO: items are normally added at the rear and removed from the front.' },
  { id: 'ds-3', topic: 'Data Structures', question: 'In a basic singly linked-list node, what is commonly stored?', options: ['Data and a pointer to the next node', 'Only an array index', 'Two parent pointers', 'Only the node color'], correct: 0, explanation: 'A singly linked-list node stores its data and a link (pointer) to the next node. The last node usually points to `nullptr`.' },
  { id: 'ds-4', topic: 'Data Structures', question: 'What is the maximum number of children a node can have in a binary tree?', options: ['1', '2', '3', 'Unlimited'], correct: 1, explanation: 'A binary tree node has at most two children, commonly called the left child and right child.' },
  { id: 'ds-5', topic: 'Data Structures', question: 'What is the visit order for an inorder traversal of a binary tree?', options: ['Root, Left, Right', 'Left, Right, Root', 'Left, Root, Right', 'Right, Root, Left only'], correct: 2, explanation: 'Inorder traversal visits the left subtree, then the root node, then the right subtree.' },
]


type ChallengeDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'
type ChallengeTestCase = { input: string; expected: string }
type CodingChallenge = {
  id: string
  title: string
  difficulty: ChallengeDifficulty
  minutes: number
  topic: string
  description: string
  requirements: string[]
  sampleInput: string
  sampleOutput: string
  starterCode: string
  hint: string
  tests: ChallengeTestCase[]
}
type ChallengeTestResult = {
  index: number
  input: string
  expected: string
  actual: string
  passed: boolean
  error?: string
}

type ProgressRecord = {
  id: string
  kind: 'Quiz' | 'Challenge'
  reference: string
  title: string
  topic: string
  difficulty?: ChallengeDifficulty
  score: number
  total: number
  completedAt: string
}

const codingChallenges: CodingChallenge[] = [
  {
    id: 'add-two-numbers', title: 'Add Two Numbers', difficulty: 'Beginner', minutes: 10, topic: 'Input / Output',
    description: 'Read two integers from standard input and print their sum.',
    requirements: ['Read two integer values.', 'Calculate their sum.', 'Print only the result followed by a newline.'],
    sampleInput: '3 4', sampleOutput: '7',
    starterCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n\n    // TODO: calculate and print the sum\n\n    return 0;\n}`,
    hint: 'Use the + operator, then send the result to cout.',
    tests: [{ input: '3 4', expected: '7' }, { input: '-5 8', expected: '3' }, { input: '100 250', expected: '350' }],
  },
  {
    id: 'even-or-odd', title: 'Even or Odd', difficulty: 'Beginner', minutes: 10, topic: 'If / Else',
    description: 'Read one integer and print whether it is Even or Odd.',
    requirements: ['Read one integer n.', 'Use the remainder operator to test divisibility by 2.', 'Print exactly Even or Odd.'],
    sampleInput: '8', sampleOutput: 'Even',
    starterCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n\n    // TODO: check whether n is even or odd\n\n    return 0;\n}`,
    hint: 'A number is even when n % 2 equals 0.',
    tests: [{ input: '8', expected: 'Even' }, { input: '-3', expected: 'Odd' }, { input: '0', expected: 'Even' }],
  },
  {
    id: 'factorial', title: 'Factorial with a Loop', difficulty: 'Intermediate', minutes: 15, topic: 'Loops',
    description: 'Calculate n factorial (n!) using a loop. The input is between 0 and 20.',
    requirements: ['Read an integer n.', 'Start the result at 1 and multiply by every integer from 1 through n.', 'Print the result as a whole number.'],
    sampleInput: '5', sampleOutput: '120',
    starterCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    long long result = 1;\n\n    // TODO: use a loop to calculate n!\n\n    cout << result << endl;\n    return 0;\n}`,
    hint: 'For each i from 1 to n, multiply result by i. 0! is 1.',
    tests: [{ input: '0', expected: '1' }, { input: '5', expected: '120' }, { input: '10', expected: '3628800' }],
  },
  {
    id: 'palindrome', title: 'Palindrome Word', difficulty: 'Intermediate', minutes: 15, topic: 'Strings',
    description: 'Read one lowercase word and determine whether it reads the same forward and backward.',
    requirements: ['Read one word without spaces.', 'Compare characters from the two ends moving toward the center.', 'Print Palindrome or Not Palindrome.'],
    sampleInput: 'level', sampleOutput: 'Palindrome',
    starterCode: `#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string word;\n    cin >> word;\n    bool isPalindrome = true;\n\n    // TODO: compare matching characters from both ends\n\n    cout << (isPalindrome ? "Palindrome" : "Not Palindrome") << endl;\n    return 0;\n}`,
    hint: 'Compare word[i] with word[word.length() - 1 - i] until the middle.',
    tests: [{ input: 'level', expected: 'Palindrome' }, { input: 'hello', expected: 'Not Palindrome' }, { input: 'madam', expected: 'Palindrome' }],
  },
  {
    id: 'binary-search', title: 'Binary Search', difficulty: 'Advanced', minutes: 20, topic: 'Arrays / Searching',
    description: 'Search for a target in a sorted array and print its zero-based index, or -1 if it is absent.',
    requirements: ['Read n, then n integers in ascending order, then the target.', 'Use binary search; repeatedly reduce the search range by half.', 'Print the zero-based index of the target or -1.'],
    sampleInput: '5\n1 3 5 7 9\n7', sampleOutput: '3',
    starterCode: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    int arr[1000];\n    for (int i = 0; i < n; i++) cin >> arr[i];\n    int target;\n    cin >> target;\n\n    // TODO: implement binary search\n\n    return 0;\n}`,
    hint: 'Maintain low and high indices. Compute mid = low + (high - low) / 2.',
    tests: [{ input: '5\n1 3 5 7 9\n7', expected: '3' }, { input: '5\n1 3 5 7 9\n2', expected: '-1' }, { input: '6\n2 4 6 8 10 12\n6', expected: '2' }],
  },
  {
    id: 'second-largest', title: 'Second Largest Distinct', difficulty: 'Advanced', minutes: 20, topic: 'Arrays / Logic',
    description: 'Find the second-largest distinct value in a list of integers.',
    requirements: ['Read n followed by n integers.', 'Ignore duplicate values when identifying the largest and second-largest values.', 'Print the second-largest distinct value, or Not Found if it does not exist.'],
    sampleInput: '5\n10 30 20 40 50', sampleOutput: '40',
    starterCode: `#include <iostream>\n#include <climits>\nusing namespace std;\n\nint main() {\n    int n;\n    cin >> n;\n    int largest = INT_MIN;\n    int second = INT_MIN;\n\n    // TODO: find the two largest distinct values\n\n    return 0;\n}`,
    hint: 'When a new largest value is found, move the old largest into second. Do not count equal values twice.',
    tests: [{ input: '5\n10 30 20 40 50', expected: '40' }, { input: '4\n5 5 3 2', expected: '3' }, { input: '4\n7 7 7 7', expected: 'Not Found' }],
  },
]

type SnippetCategory = 'All snippets' | 'Basics' | 'Control Flow' | 'Loops' | 'Functions' | 'Arrays' | 'Data Structures' | 'My Snippets'
type Snippet = {
  id: string
  title: string
  category: Exclude<SnippetCategory, 'All snippets' | 'My Snippets'>
  description: string
  code: string
  personal: boolean
}

const builtInSnippets: Snippet[] = [
  { id: 'hello-world', title: 'Hello, World!', category: 'Basics', description: 'Your first C++ program with standard output.', personal: false, code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}` },
  { id: 'input-output', title: 'Read and print values', category: 'Basics', description: 'Read two integers and display them.', personal: false, code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cout << "Enter two numbers: ";\n    cin >> a >> b;\n    cout << "First: " << a << endl;\n    cout << "Second: " << b << endl;\n    return 0;\n}` },
  { id: 'if-else', title: 'If / Else condition', category: 'Control Flow', description: 'Check whether a number is positive, negative or zero.', personal: false, code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int number;\n    cin >> number;\n\n    if (number > 0) {\n        cout << "Positive" << endl;\n    } else if (number < 0) {\n        cout << "Negative" << endl;\n    } else {\n        cout << "Zero" << endl;\n    }\n    return 0;\n}` },
  { id: 'for-loop', title: 'For loop', category: 'Loops', description: 'Print numbers from 1 to 5 and calculate their sum.', personal: false, code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int sum = 0;\n    for (int i = 1; i <= 5; i++) {\n        cout << i << endl;\n        sum += i;\n    }\n    cout << "Sum: " << sum << endl;\n    return 0;\n}` },
  { id: 'while-loop', title: 'While loop', category: 'Loops', description: 'Repeat a task while a condition remains true.', personal: false, code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int count = 1;\n    while (count <= 5) {\n        cout << count << endl;\n        count++;\n    }\n    return 0;\n}` },
  { id: 'function', title: 'Create and call a function', category: 'Functions', description: 'Return the sum of two integer arguments.', personal: false, code: `#include <iostream>\nusing namespace std;\n\nint add(int a, int b) {\n    return a + b;\n}\n\nint main() {\n    cout << add(4, 6) << endl;\n    return 0;\n}` },
  { id: 'array-traversal', title: 'Array traversal', category: 'Arrays', description: 'Visit every array element using an index.', personal: false, code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int values[5] = {10, 20, 30, 40, 50};\n    for (int i = 0; i < 5; i++) {\n        cout << "Index " << i << ": " << values[i] << endl;\n    }\n    return 0;\n}` },
  { id: 'array-largest', title: 'Find largest in an array', category: 'Arrays', description: 'Track the largest value while traversing an array.', personal: false, code: `#include <iostream>\nusing namespace std;\n\nint main() {\n    int values[6] = {12, 5, 29, 8, 17, 3};\n    int largest = values[0];\n\n    for (int i = 1; i < 6; i++) {\n        if (values[i] > largest) {\n            largest = values[i];\n        }\n    }\n    cout << "Largest: " << largest << endl;\n    return 0;\n}` },
  { id: 'stack-vector', title: 'Stack using vector', category: 'Data Structures', description: 'Demonstrate push, top and pop with a stack.', personal: false, code: `#include <iostream>\n#include <stack>\nusing namespace std;\n\nint main() {\n    stack<int> numbers;\n    numbers.push(10);\n    numbers.push(20);\n    numbers.push(30);\n\n    cout << "Top: " << numbers.top() << endl;\n    numbers.pop();\n    cout << "New top: " << numbers.top() << endl;\n    return 0;\n}` },
  { id: 'queue', title: 'Queue basics', category: 'Data Structures', description: 'Demonstrate FIFO insertion and removal.', personal: false, code: `#include <iostream>\n#include <queue>\nusing namespace std;\n\nint main() {\n    queue<int> line;\n    line.push(10);\n    line.push(20);\n    line.push(30);\n\n    cout << "Front: " << line.front() << endl;\n    line.pop();\n    cout << "New front: " << line.front() << endl;\n    return 0;\n}` },
  { id: 'linked-list', title: 'Singly linked list node', category: 'Data Structures', description: 'Create and connect two nodes, then print their values.', personal: false, code: `#include <iostream>\nusing namespace std;\n\nstruct Node {\n    int data;\n    Node* next;\n};\n\nint main() {\n    Node first{10, nullptr};\n    Node second{20, nullptr};\n    first.next = &second;\n\n    Node* current = &first;\n    while (current != nullptr) {\n        cout << current->data << " ";\n        current = current->next;\n    }\n    cout << endl;\n    return 0;\n}` },
  { id: 'binary-tree', title: 'Binary tree node', category: 'Data Structures', description: 'Build a small binary tree and visit it in preorder.', personal: false, code: `#include <iostream>\nusing namespace std;\n\nstruct Node {\n    int data;\n    Node* left;\n    Node* right;\n};\n\nvoid preorder(Node* root) {\n    if (root == nullptr) return;\n    cout << root->data << " ";\n    preorder(root->left);\n    preorder(root->right);\n}\n\nint main() {\n    Node left{2, nullptr, nullptr};\n    Node right{3, nullptr, nullptr};\n    Node root{1, &left, &right};\n    preorder(&root);\n    cout << endl;\n    return 0;\n}` },
]

function readStoredSnippets(storageKey: string): Snippet[] {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is Snippet => Boolean(
      item && typeof item === 'object' &&
      typeof (item as Snippet).id === 'string' &&
      typeof (item as Snippet).title === 'string' &&
      typeof (item as Snippet).description === 'string' &&
      typeof (item as Snippet).code === 'string' &&
      (item as Snippet).personal === true &&
      ['Basics', 'Control Flow', 'Loops', 'Functions', 'Arrays', 'Data Structures'].includes((item as Snippet).category)
    )).slice(0, 100)
  } catch {
    return []
  }
}

function readStoredProgress(storageKey: string): ProgressRecord[] {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ProgressRecord => Boolean(
      item && typeof item === 'object' &&
      typeof (item as ProgressRecord).id === 'string' &&
      ((item as ProgressRecord).kind === 'Quiz' || (item as ProgressRecord).kind === 'Challenge') &&
      typeof (item as ProgressRecord).reference === 'string' &&
      typeof (item as ProgressRecord).title === 'string' &&
      typeof (item as ProgressRecord).topic === 'string' &&
      typeof (item as ProgressRecord).score === 'number' &&
      typeof (item as ProgressRecord).total === 'number' &&
      typeof (item as ProgressRecord).completedAt === 'string'
    )).slice(0, 100)
  } catch {
    return []
  }
}

function mergeById<T extends { id: string }>(remoteItems: T[], localItems: T[]): T[] {
  const merged = new Map<string, T>()
  remoteItems.forEach((item) => merged.set(item.id, item))
  // Local account cache wins for matching IDs so offline edits are not lost.
  localItems.forEach((item) => merged.set(item.id, item))
  return Array.from(merged.values())
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


type TreeTraversal = 'preorder' | 'inorder' | 'postorder' | 'levelorder'
type TreeOperation = TreeTraversal | 'search'

type TreeNode = {
  id: number
  value: number
  left: number | null
  right: number | null
}

type TreeFrame = {
  activeId: number | null
  visited: number[]
  output: number[]
  label: string
  message: string
}

function makeBinaryTree(values: number[]): TreeNode[] {
  return values.map((value, index) => ({
    id: index,
    value,
    left: index * 2 + 1 < values.length ? index * 2 + 1 : null,
    right: index * 2 + 2 < values.length ? index * 2 + 2 : null,
  }))
}

function getTraversalOrder(nodes: TreeNode[], traversal: TreeTraversal): number[] {
  if (!nodes.length) return []
  const order: number[] = []

  const visitPre = (id: number | null) => {
    if (id === null) return
    order.push(id)
    visitPre(nodes[id].left)
    visitPre(nodes[id].right)
  }

  const visitIn = (id: number | null) => {
    if (id === null) return
    visitIn(nodes[id].left)
    order.push(id)
    visitIn(nodes[id].right)
  }

  const visitPost = (id: number | null) => {
    if (id === null) return
    visitPost(nodes[id].left)
    visitPost(nodes[id].right)
    order.push(id)
  }

  if (traversal === 'preorder') visitPre(0)
  if (traversal === 'inorder') visitIn(0)
  if (traversal === 'postorder') visitPost(0)

  if (traversal === 'levelorder') {
    const queue: number[] = [0]
    while (queue.length) {
      const id = queue.shift()!
      order.push(id)
      const node = nodes[id]
      if (node.left !== null) queue.push(node.left)
      if (node.right !== null) queue.push(node.right)
    }
  }
  return order
}

function buildTreeTraversalFrames(nodes: TreeNode[], traversal: TreeTraversal): TreeFrame[] {
  const names: Record<TreeTraversal, string> = {
    preorder: 'Preorder (Root → Left → Right)',
    inorder: 'Inorder (Left → Root → Right)',
    postorder: 'Postorder (Left → Right → Root)',
    levelorder: 'Level Order (Level by Level)',
  }
  const order = getTraversalOrder(nodes, traversal)
  const frames: TreeFrame[] = [{
    activeId: null,
    visited: [],
    output: [],
    label: 'START',
    message: `${names[traversal]} traversal starts at the root node ${nodes[0]?.value ?? ''}.`,
  }]
  const visited: number[] = []
  const output: number[] = []

  order.forEach((id, step) => {
    const node = nodes[id]
    visited.push(id)
    output.push(node.value)
    frames.push({
      activeId: id,
      visited: [...visited],
      output: [...output],
      label: `VISIT NODE ${node.value}`,
      message: `Step ${step + 1}: visit node ${node.value}. ${names[traversal]} determines when each node is added to the output.`,
    })
  })

  frames.push({
    activeId: null,
    visited: [...visited],
    output: [...output],
    label: 'TRAVERSAL COMPLETE',
    message: `All ${nodes.length} nodes have been visited. Final traversal: ${output.join(' → ')}.`,
  })
  return frames
}

function buildTreeSearchFrames(nodes: TreeNode[], target: number): TreeFrame[] {
  const frames: TreeFrame[] = [{
    activeId: null,
    visited: [],
    output: [],
    label: 'SEARCH START',
    message: `Search for ${target} using level-order traversal.`,
  }]
  const queue = nodes.length ? [0] : []
  const visited: number[] = []
  let found = false

  while (queue.length) {
    const id = queue.shift()!
    const node = nodes[id]
    visited.push(id)
    const matched = node.value === target
    frames.push({
      activeId: id,
      visited: [...visited],
      output: visited.map((item) => nodes[item].value),
      label: matched ? 'VALUE FOUND' : 'CHECK NODE',
      message: matched
        ? `Node ${node.value} matches ${target}. Search successful at level-order position ${visited.length}.`
        : `Node ${node.value} does not match ${target}. Continue to the next node.`,
    })
    if (matched) {
      found = true
      break
    }
    if (node.left !== null) queue.push(node.left)
    if (node.right !== null) queue.push(node.right)
  }

  frames.push({
    activeId: found ? frames[frames.length - 1].activeId : null,
    visited: [...visited],
    output: visited.map((item) => nodes[item].value),
    label: found ? 'SEARCH COMPLETE' : 'NOT FOUND',
    message: found ? `${target} is present in the tree.` : `${target} is not present in this tree.`,
  })
  return frames
}

const featureCards = [
  { icon: '🧠', number: '01', title: 'AI Code Teacher', text: 'Understand tricky code with friendly, step-by-step explanations.', tone: 'lavender' },
  { icon: '🎬', number: '02', title: 'Visual Code Steps', text: 'Follow variables and program logic as each line is explored.', tone: 'peach' },
  { icon: '🌳', number: '03', title: 'Data Structures Lab', text: 'Explore arrays, stacks, queues, linked lists and trees.', tone: 'mint' },
  { icon: '🐞', number: '04', title: 'Friendly Debugging', text: 'Learn what an error means and how to approach fixing it.', tone: 'blue' },
  { icon: '📝', number: '05', title: 'C++ Quiz Center', text: 'Check your understanding with topic-based questions and instant explanations.', tone: 'lavender' },
  { icon: '🏁', number: '06', title: 'Coding Challenge Arena', text: 'Solve timed C++ problems and test your solutions against sample cases.', tone: 'blue' },
]

function App() {
  const [page, setPage] = useState<'home' | 'editor'>('home')
  const [session, setSession] = useState<Session | null>(null)
  const activeUserId = session?.user?.id ?? null
  const activeUserIdRef = useRef<string | null>(null)
  activeUserIdRef.current = activeUserId
  const [dataOwnerUserId, setDataOwnerUserId] = useState<string | null>(null)
  const [cloudReadyUserId, setCloudReadyUserId] = useState<string | null>(null)
  const [cloudStatus, setCloudStatus] = useState<'local' | 'loading' | 'syncing' | 'synced' | 'error'>('local')
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [accountNotice, setAccountNotice] = useState('Sign in to sync your saved snippets and learning progress across devices.')
  const [code, setCode] = useState(starterCode)
  const [selectedExample, setSelectedExample] = useState('starter')
  const [activeTab, setActiveTab] = useState<'output' | 'help' | 'visualizer' | 'arrays' | 'linear' | 'linked' | 'tree' | 'teacher' | 'quiz' | 'challenge' | 'progress' | 'snippets' | 'account'>('output')
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
  const [teacherMessages, setTeacherMessages] = useState<TeacherMessage[]>([])
  const [teacherQuestion, setTeacherQuestion] = useState('')
  const [isTeaching, setIsTeaching] = useState(false)
  const [teacherError, setTeacherError] = useState('')
  const [quizTopic, setQuizTopic] = useState<QuizTopic>('All topics')
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [quizFinished, setQuizFinished] = useState(false)
  const quizQuestionsForTopic = useMemo(() => quizTopic === 'All topics' ? quizQuestions : quizQuestions.filter((question) => question.topic === quizTopic), [quizTopic])
  const currentQuizQuestion = quizQuestionsForTopic[Math.min(quizIndex, quizQuestionsForTopic.length - 1)]
  const quizAnsweredCount = quizQuestionsForTopic.filter((question) => quizAnswers[question.id] !== undefined).length
  const quizScore = quizQuestionsForTopic.reduce((total, question) => total + (quizAnswers[question.id] === question.correct ? 1 : 0), 0)
  const quizProgress = quizQuestionsForTopic.length ? (quizAnsweredCount / quizQuestionsForTopic.length) * 100 : 0
  const [challengeDifficulty, setChallengeDifficulty] = useState<'All levels' | ChallengeDifficulty>('All levels')
  const [selectedChallengeId, setSelectedChallengeId] = useState(codingChallenges[0].id)
  const selectedChallenge = codingChallenges.find((challenge) => challenge.id === selectedChallengeId) ?? codingChallenges[0]
  const visibleChallenges = challengeDifficulty === 'All levels' ? codingChallenges : codingChallenges.filter((challenge) => challenge.difficulty === challengeDifficulty)
  const [challengeSecondsLeft, setChallengeSecondsLeft] = useState(codingChallenges[0].minutes * 60)
  const [challengeTimerRunning, setChallengeTimerRunning] = useState(false)
  const [challengeChecking, setChallengeChecking] = useState(false)
  const [challengeStatus, setChallengeStatus] = useState('Choose a challenge, load its starter code, and start the timer.')
  const [challengeTestResults, setChallengeTestResults] = useState<ChallengeTestResult[]>([])
  const challengePassedCount = challengeTestResults.filter((result) => result.passed).length
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>(() => {
    try {
      const saved = window.localStorage.getItem('codelens-progress-v1')
      if (!saved) return []
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((item): item is ProgressRecord => Boolean(
        item && typeof item === 'object' &&
        typeof (item as ProgressRecord).id === 'string' &&
        ((item as ProgressRecord).kind === 'Quiz' || (item as ProgressRecord).kind === 'Challenge') &&
        typeof (item as ProgressRecord).reference === 'string' &&
        typeof (item as ProgressRecord).title === 'string' &&
        typeof (item as ProgressRecord).topic === 'string' &&
        typeof (item as ProgressRecord).score === 'number' &&
        typeof (item as ProgressRecord).total === 'number' &&
        typeof (item as ProgressRecord).completedAt === 'string'
      )).slice(0, 100)
    } catch {
      return []
    }
  })
  const [snippetCategory, setSnippetCategory] = useState<SnippetCategory>('All snippets')
  const [snippetSearch, setSnippetSearch] = useState('')
  const [snippetTitle, setSnippetTitle] = useState('')
  const [snippetSaveCategory, setSnippetSaveCategory] = useState<Exclude<SnippetCategory, 'All snippets' | 'My Snippets'>>('Basics')
  const [snippetNotice, setSnippetNotice] = useState('Choose a snippet to preview, copy or insert it into the editor.')
  const [personalSnippets, setPersonalSnippets] = useState<Snippet[]>(() => {
    try {
      const saved = window.localStorage.getItem('codelens-snippets-v1')
      if (!saved) return []
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((item): item is Snippet => Boolean(
        item && typeof item === 'object' &&
        typeof (item as Snippet).id === 'string' &&
        typeof (item as Snippet).title === 'string' &&
        typeof (item as Snippet).description === 'string' &&
        typeof (item as Snippet).code === 'string' &&
        (item as Snippet).personal === true &&
        ['Basics', 'Control Flow', 'Loops', 'Functions', 'Arrays', 'Data Structures'].includes((item as Snippet).category)
      )).slice(0, 100)
    } catch {
      return []
    }
  })
  const [selectedSnippetId, setSelectedSnippetId] = useState('hello-world')
  const allSnippets = useMemo(() => [...builtInSnippets, ...personalSnippets], [personalSnippets])
  const visibleSnippets = useMemo(() => {
    const query = snippetSearch.trim().toLowerCase()
    return allSnippets.filter((snippet) => {
      const categoryMatch = snippetCategory === 'All snippets'
        || (snippetCategory === 'My Snippets' ? snippet.personal : snippet.category === snippetCategory)
      const searchMatch = !query || `${snippet.title} ${snippet.description} ${snippet.category}`.toLowerCase().includes(query)
      return categoryMatch && searchMatch
    })
  }, [allSnippets, snippetCategory, snippetSearch])
  const selectedSnippet = visibleSnippets.find((snippet) => snippet.id === selectedSnippetId) ?? visibleSnippets[0] ?? allSnippets[0]

  useEffect(() => {
    if (!supabase) return
    let alive = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) setAccountNotice(`Could not restore the sign-in session: ${error.message}`)
      setSession(data.session)
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!activeUserId || !supabase) {
      setCloudReadyUserId(null)
      setDataOwnerUserId(null)
      setPersonalSnippets(readStoredSnippets('codelens-snippets-v1'))
      setProgressRecords(readStoredProgress('codelens-progress-v1'))
      setCloudStatus('local')
      setLastCloudSync(null)
      return () => { cancelled = true }
    }

    const client = supabase
    if (!client) {
      setCloudReadyUserId(null)
      setDataOwnerUserId(null)
      setCloudStatus('local')
      return () => { cancelled = true }
    }

    const userId = activeUserId
    const snippetsKey = `codelens-snippets-v1:${userId}`
    const progressKey = `codelens-progress-v1:${userId}`
    setCloudStatus('loading')
    setCloudReadyUserId(null)

    const loadAccountData = async () => {
      const { data, error } = await client
        .from('codelens_user_data')
        .select('snippets, progress, updated_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        const cachedSnippets = readStoredSnippets(snippetsKey)
        const cachedProgress = readStoredProgress(progressKey)
        const mayImportGuest = !window.localStorage.getItem('codelens-cloud-guest-migrated-v1')
        setPersonalSnippets(cachedSnippets.length ? cachedSnippets : (mayImportGuest ? readStoredSnippets('codelens-snippets-v1') : []))
        setProgressRecords(cachedProgress.length ? cachedProgress : (mayImportGuest ? readStoredProgress('codelens-progress-v1') : []))
        setDataOwnerUserId(userId)
        setCloudStatus('error')
        setAccountNotice(`Signed in, but cloud storage is not ready: ${error.message}. Run the SQL setup from the update ZIP, then try Sync now.`)
        return
      }

      const accountLocalSnippets = readStoredSnippets(snippetsKey)
      const accountLocalProgress = readStoredProgress(progressKey)
      const guestMigrationAvailable = !window.localStorage.getItem('codelens-cloud-guest-migrated-v1')
      const guestSnippets = guestMigrationAvailable ? readStoredSnippets('codelens-snippets-v1') : []
      const guestProgress = guestMigrationAvailable ? readStoredProgress('codelens-progress-v1') : []
      const baseSnippets = Array.isArray(data?.snippets)
        ? data.snippets as Snippet[]
        : (accountLocalSnippets.length ? accountLocalSnippets : guestSnippets)
      const baseProgress = Array.isArray(data?.progress)
        ? data.progress as ProgressRecord[]
        : (accountLocalProgress.length ? accountLocalProgress : guestProgress)
      const mergedSnippets = mergeById(baseSnippets, accountLocalSnippets).slice(0, 100)
      const mergedProgress = mergeById(baseProgress, accountLocalProgress)
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
        .slice(0, 100)

      const { error: saveError } = await client
        .from('codelens_user_data')
        .upsert({
          user_id: userId,
          snippets: mergedSnippets,
          progress: mergedProgress,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (cancelled) return
      setPersonalSnippets(mergedSnippets)
      setProgressRecords(mergedProgress)
      setDataOwnerUserId(userId)
      if (saveError) {
        setCloudStatus('error')
        setAccountNotice(`Your account is signed in, but initial sync failed: ${saveError.message}. Your data remains saved on this device.`)
        return
      }
      if (guestMigrationAvailable && (!data || guestSnippets.length || guestProgress.length)) {
        window.localStorage.setItem('codelens-cloud-guest-migrated-v1', 'true')
      }
      setCloudReadyUserId(userId)
      setCloudStatus('synced')
      setLastCloudSync(new Date().toISOString())
      setAccountNotice('Your snippets and learning progress are connected to this account.')
    }

    loadAccountData().catch((error: unknown) => {
      if (cancelled) return
      const cachedSnippets = readStoredSnippets(snippetsKey)
      const cachedProgress = readStoredProgress(progressKey)
      const mayImportGuest = !window.localStorage.getItem('codelens-cloud-guest-migrated-v1')
      setPersonalSnippets(cachedSnippets.length ? cachedSnippets : (mayImportGuest ? readStoredSnippets('codelens-snippets-v1') : []))
      setProgressRecords(cachedProgress.length ? cachedProgress : (mayImportGuest ? readStoredProgress('codelens-progress-v1') : []))
      setDataOwnerUserId(userId)
      setCloudStatus('error')
      setAccountNotice(error instanceof Error ? error.message : 'Could not load your cloud data.')
    })

    return () => { cancelled = true }
  }, [activeUserId])

  useEffect(() => {
    if (dataOwnerUserId !== activeUserId) return
    const storageKey = activeUserId ? `codelens-snippets-v1:${activeUserId}` : 'codelens-snippets-v1'
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(personalSnippets))
    } catch {
      setSnippetNotice('Browser storage is full or unavailable. Your saved snippets may not persist after refresh.')
    }
  }, [personalSnippets, activeUserId, dataOwnerUserId])

  useEffect(() => {
    if (dataOwnerUserId !== activeUserId) return
    const storageKey = activeUserId ? `codelens-progress-v1:${activeUserId}` : 'codelens-progress-v1'
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(progressRecords))
    } catch {
      // Progress remains available for the current session if browser storage is unavailable.
    }
  }, [progressRecords, activeUserId, dataOwnerUserId])

  useEffect(() => {
    if (!supabase || !activeUserId || cloudReadyUserId !== activeUserId || dataOwnerUserId !== activeUserId) return
    const client = supabase
    const userId = activeUserId
    const timeoutId = window.setTimeout(async () => {
      setCloudStatus('syncing')
      const { error } = await client
        .from('codelens_user_data')
        .upsert({
          user_id: userId,
          snippets: personalSnippets,
          progress: progressRecords,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      if (activeUserIdRef.current !== userId) return
      if (error) {
        setCloudStatus('error')
        setAccountNotice(`Cloud sync could not complete: ${error.message}. Your changes are still saved on this device.`)
      } else {
        setCloudStatus('synced')
        setLastCloudSync(new Date().toISOString())
      }
    }, 900)
    return () => window.clearTimeout(timeoutId)
  }, [personalSnippets, progressRecords, activeUserId, cloudReadyUserId, dataOwnerUserId])

  const progressSummary = useMemo(() => {
    const quizzes = progressRecords.filter((record) => record.kind === 'Quiz')
    const challenges = progressRecords.filter((record) => record.kind === 'Challenge')
    const quizScoreTotal = quizzes.reduce((sum, record) => sum + record.score, 0)
    const quizQuestionTotal = quizzes.reduce((sum, record) => sum + record.total, 0)
    const topicTotals = progressRecords.reduce<Record<string, { score: number; total: number; attempts: number }>>((totals, record) => {
      const current = totals[record.topic] ?? { score: 0, total: 0, attempts: 0 }
      current.score += record.score
      current.total += record.total
      current.attempts += 1
      totals[record.topic] = current
      return totals
    }, {})
    const dayKeys = new Set(progressRecords.map((record) => {
      const date = new Date(record.completedAt)
      if (Number.isNaN(date.getTime())) return ''
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }).filter(Boolean))
    const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    if (!dayKeys.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
    let streak = 0
    while (dayKeys.has(dayKey(cursor)) && streak < 366) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return {
      quizAttempts: quizzes.length,
      challengeAttempts: challenges.length,
      solvedChallenges: new Set(challenges.map((record) => record.reference)).size,
      quizAccuracy: quizQuestionTotal ? Math.round((quizScoreTotal / quizQuestionTotal) * 100) : null,
      streak,
      topicStats: Object.entries(topicTotals).map(([topic, stats]) => ({
        topic,
        attempts: stats.attempts,
        accuracy: stats.total ? Math.round((stats.score / stats.total) * 100) : 0,
      })).sort((a, b) => b.accuracy - a.accuracy || a.topic.localeCompare(b.topic)),
    }
  }, [progressRecords])

  useEffect(() => {
    if (!challengeTimerRunning) return
    const timerId = window.setInterval(() => {
      setChallengeSecondsLeft((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timerId)
  }, [challengeTimerRunning])

  useEffect(() => {
    if (challengeTimerRunning && challengeSecondsLeft === 0) {
      setChallengeTimerRunning(false)
      setChallengeStatus('Time is up. Reset the challenge to try again.')
    }
  }, [challengeSecondsLeft, challengeTimerRunning])


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
  const [treeValuesInput, setTreeValuesInput] = useState('50, 30, 70, 20, 40, 60, 80')
  const [treeTraversal, setTreeTraversal] = useState<TreeOperation>('inorder')
  const [treeTargetInput, setTreeTargetInput] = useState('60')
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>(makeBinaryTree([50, 30, 70, 20, 40, 60, 80]))
  const [treeFrames, setTreeFrames] = useState<TreeFrame[]>(buildTreeTraversalFrames(makeBinaryTree([50, 30, 70, 20, 40, 60, 80]), 'inorder'))
  const [treeStep, setTreeStep] = useState(0)
  const [treeError, setTreeError] = useState('')
  const currentTreeFrame = treeFrames[Math.min(treeStep, treeFrames.length - 1)]
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

  const openQuiz = () => {
    setActiveTab('quiz')
  }

  const openProgress = () => {
    setActiveTab('progress')
  }

  const openSnippets = () => {
    setActiveTab('snippets')
    setSnippetNotice('Choose a snippet to preview, copy or insert it into the editor.')
  }

  const openAccount = () => {
    setActiveTab('account')
    if (!supabaseConfigured) {
      setAccountNotice('Add your Supabase Project URL and public publishable key to .env.local to enable accounts.')
    }
  }

  const submitAccountAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) {
      setAccountNotice('Supabase is not configured. Add the two VITE_SUPABASE values to .env.local and restart Vite.')
      return
    }
    setAuthBusy(true)
    setAccountNotice('')
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (data.session) {
          setAccountNotice('Account created and signed in. Your cloud data is being prepared.')
        } else {
          setAccountNotice('Account created. Check your email for the confirmation link, then return here to sign in.')
          setAuthMode('signin')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        })
        if (error) throw error
        setAccountNotice('Signed in successfully. Loading your cloud data...')
      }
      setAuthPassword('')
    } catch (error) {
      setAccountNotice(error instanceof Error ? error.message : 'Authentication failed. Please try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  const signOutAccount = async () => {
    if (!supabase) return
    setAuthBusy(true)
    const { error } = await supabase.auth.signOut()
    setAuthBusy(false)
    if (error) {
      setAccountNotice(`Could not sign out: ${error.message}`)
    } else {
      setAccountNotice('You are signed out. Your guest data remains saved on this browser.')
      setActiveTab('account')
    }
  }

  const syncCloudNow = async () => {
    if (!supabase || !activeUserId || dataOwnerUserId !== activeUserId) return
    setCloudStatus('syncing')
    const { error } = await supabase
      .from('codelens_user_data')
      .upsert({
        user_id: activeUserId,
        snippets: personalSnippets,
        progress: progressRecords,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    if (error) {
      setCloudStatus('error')
      setAccountNotice(`Sync failed: ${error.message}. Your data is still saved locally.`)
    } else {
      setCloudReadyUserId(activeUserId)
      window.localStorage.setItem('codelens-cloud-guest-migrated-v1', 'true')
      setCloudStatus('synced')
      setLastCloudSync(new Date().toISOString())
      setAccountNotice('Sync complete. Your saved snippets and learning progress are in the cloud.')
    }
  }

  const saveCurrentSnippet = () => {
    const title = snippetTitle.trim()
    if (!title) {
      setSnippetNotice('Enter a title before saving your current code.')
      return
    }
    if (!code.trim()) {
      setSnippetNotice('The editor is empty. Add some code before saving a snippet.')
      return
    }
    const snippet: Snippet = {
      id: `personal-${Date.now()}`,
      title: title.slice(0, 60),
      category: snippetSaveCategory,
      description: 'Saved from your current editor code.',
      code,
      personal: true,
    }
    setPersonalSnippets((items) => [snippet, ...items].slice(0, 100))
    setSelectedSnippetId(snippet.id)
    setSnippetCategory('My Snippets')
    setSnippetSearch('')
    setSnippetTitle('')
    setSnippetNotice(`Saved "${snippet.title}" to My Snippets on this browser.`)
  }

  const copySnippet = async (snippet: Snippet) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable in this browser context.')
      await navigator.clipboard.writeText(snippet.code)
      setSnippetNotice(`Copied "${snippet.title}" to the clipboard.`)
    } catch {
      setSnippetNotice('Copy was blocked by the browser. Select the code preview and press Ctrl+C instead.')
    }
  }

  const insertSnippet = (snippet: Snippet) => {
    setCode(snippet.code)
    setSelectedExample('starter')
    setExecution(null)
    setNotice(`Loaded snippet: ${snippet.title}. Review it, then press Run when ready.`)
    setActiveTab('output')
  }

  const deletePersonalSnippet = (snippet: Snippet) => {
    if (!snippet.personal) return
    if (!window.confirm(`Delete the saved snippet "${snippet.title}"?`)) return
    setPersonalSnippets((items) => items.filter((item) => item.id !== snippet.id))
    setSelectedSnippetId('hello-world')
    setSnippetNotice(`Deleted "${snippet.title}" from My Snippets.`)
  }

  const recordProgress = (record: Omit<ProgressRecord, 'id' | 'completedAt'>) => {
    const completedAt = new Date().toISOString()
    const id = `${record.kind}-${record.reference}-${Date.now()}`
    setProgressRecords((records) => [{ ...record, id, completedAt }, ...records].slice(0, 100))
  }

  const clearProgress = () => {
    if (!window.confirm('Clear all saved CodeLens learning progress from this browser?')) return
    setProgressRecords([])
  }

  const openChallengeArena = () => {
    setActiveTab('challenge')
    setChallengeStatus((status) => status || 'Choose a challenge, load its starter code, and start the timer.')
  }

  const selectCodingChallenge = (challenge: CodingChallenge) => {
    setSelectedChallengeId(challenge.id)
    setChallengeTimerRunning(false)
    setChallengeSecondsLeft(challenge.minutes * 60)
    setChallengeTestResults([])
    setChallengeStatus('Challenge selected. Load the starter code when you are ready.')
  }

  const changeChallengeDifficulty = (difficulty: 'All levels' | ChallengeDifficulty) => {
    setChallengeDifficulty(difficulty)
    const available = difficulty === 'All levels' ? codingChallenges : codingChallenges.filter((challenge) => challenge.difficulty === difficulty)
    if (available[0]) selectCodingChallenge(available[0])
  }

  const startCodingChallenge = () => {
    setCode(selectedChallenge.starterCode)
    setSelectedExample('starter')
    setStdin(selectedChallenge.sampleInput)
    setExecution(null)
    setChallengeTestResults([])
    setChallengeSecondsLeft(selectedChallenge.minutes * 60)
    setChallengeStatus('Timer started. Write your solution in the editor, then run the test cases.')
    setChallengeTimerRunning(true)
    setActiveTab('challenge')
  }

  const resetCodingChallenge = () => {
    setChallengeTimerRunning(false)
    setChallengeSecondsLeft(selectedChallenge.minutes * 60)
    setChallengeTestResults([])
    setChallengeStatus('Challenge reset. Start again when you are ready.')
    setCode(selectedChallenge.starterCode)
    setStdin(selectedChallenge.sampleInput)
    setExecution(null)
  }

  const submitCodingChallenge = async () => {
    if (challengeChecking || challengeSecondsLeft <= 0 || !challengeTimerRunning) return
    setChallengeChecking(true)
    setChallengeStatus(`Running ${selectedChallenge.tests.length} test cases through the C++ compiler...`)
    setChallengeTestResults([])
    const results: ChallengeTestResult[] = []

    try {
      for (let index = 0; index < selectedChallenge.tests.length; index += 1) {
        const test = selectedChallenge.tests[index]
        try {
          const response = await fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, stdin: test.input }),
          })
          const result = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(result.error || `Compiler request failed (${response.status}).`)
          const actual = typeof result.output === 'string' ? result.output : ''
          const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
          results.push({
            index: index + 1,
            input: test.input,
            expected: test.expected,
            actual,
            passed: normalize(actual) === normalize(test.expected),
          })
        } catch (error) {
          results.push({
            index: index + 1,
            input: test.input,
            expected: test.expected,
            actual: '',
            passed: false,
            error: error instanceof Error ? error.message : 'Could not reach the C++ compiler.',
          })
        }
        setChallengeTestResults([...results])
      }

      const passed = results.filter((result) => result.passed).length
      if (passed === results.length) {
        setChallengeStatus(`All ${results.length} tests passed. Challenge completed! Great work.`)
        setChallengeTimerRunning(false)
        recordProgress({
          kind: 'Challenge',
          reference: selectedChallenge.id,
          title: selectedChallenge.title,
          topic: selectedChallenge.topic,
          difficulty: selectedChallenge.difficulty,
          score: passed,
          total: results.length,
        })
      } else {
        setChallengeStatus(`${passed} of ${results.length} tests passed. Review the failed cases and update your code.`)
      }
    } finally {
      setChallengeChecking(false)
    }
  }

  const formatChallengeTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
    const remainingSeconds = (seconds % 60).toString().padStart(2, '0')
    return `${minutes}:${remainingSeconds}`
  }

  const changeQuizTopic = (topic: QuizTopic) => {
    setQuizTopic(topic)
    setQuizIndex(0)
    setQuizAnswers({})
    setQuizFinished(false)
  }

  const answerQuizQuestion = (answerIndex: number) => {
    if (!currentQuizQuestion || quizFinished || quizAnswers[currentQuizQuestion.id] !== undefined) return
    setQuizAnswers((answers) => ({ ...answers, [currentQuizQuestion.id]: answerIndex }))
  }

  const moveToNextQuizQuestion = () => {
    if (!currentQuizQuestion || quizAnswers[currentQuizQuestion.id] === undefined) return
    if (quizIndex < quizQuestionsForTopic.length - 1) setQuizIndex((index) => index + 1)
    else {
      recordProgress({
        kind: 'Quiz',
        reference: quizTopic,
        title: quizTopic === 'All topics' ? 'Full C++ Quiz' : `${quizTopic} Quiz`,
        topic: quizTopic === 'All topics' ? 'Mixed Topics' : quizTopic,
        score: quizScore,
        total: quizQuestionsForTopic.length,
      })
      setQuizFinished(true)
    }
  }

  const restartQuiz = () => {
    setQuizIndex(0)
    setQuizAnswers({})
    setQuizFinished(false)
  }

  const openTeacher = () => {
    setActiveTab('teacher')
    setTeacherError('')
  }

  const askTeacher = async (prompt?: string) => {
    const question = (prompt ?? teacherQuestion).trim()
    if (!question || isTeaching) return

    const previousMessages = teacherMessages.slice(-8)
    setTeacherMessages((messages) => [...messages, { role: 'user', content: question }])
    setTeacherQuestion('')
    setTeacherError('')
    setIsTeaching(true)

    try {
      const response = await fetch('/api/teach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          question,
          language,
          history: previousMessages,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `AI Teacher request failed (${response.status}).`)
      const answer = typeof result.answer === 'string' ? result.answer.trim() : ''
      if (!answer) throw new Error('The local AI returned an empty answer. Please try again.')
      setTeacherMessages((messages) => [...messages, { role: 'assistant', content: answer }])
    } catch (error) {
      setTeacherError(error instanceof Error ? error.message : 'Could not reach the local AI Teacher.')
    } finally {
      setIsTeaching(false)
    }
  }

  const clearTeacherChat = () => {
    setTeacherMessages([])
    setTeacherError('')
  }

  const openVisualizer = () => {
    setVisualIndex(0)
    setActiveTab('visualizer')
  }

  const openTreeLab = () => {
    setActiveTab('tree')
    setTreeError('')
  }

  const buildTreeAnimation = () => {
    setTreeError('')
    const rawValues = treeValuesInput.split(',').map((part) => part.trim()).filter(Boolean)
    if (rawValues.length === 0) {
      setTreeError('Enter at least one numeric node value.')
      return
    }
    if (rawValues.length > 15) {
      setTreeError('For this visual demo, use up to 15 nodes (maximum 4 levels).')
      return
    }
    const values = rawValues.map(Number)
    if (values.some((value) => !Number.isFinite(value))) {
      setTreeError('Node values must be valid numbers separated by commas.')
      return
    }

    const nodes = makeBinaryTree(values)
    setTreeNodes(nodes)
    if (treeTraversal === 'search') {
      const target = Number(treeTargetInput)
      if (!Number.isFinite(target)) {
        setTreeError('Enter a valid number to search.')
        return
      }
      setTreeFrames(buildTreeSearchFrames(nodes, target))
    } else {
      setTreeFrames(buildTreeTraversalFrames(nodes, treeTraversal))
    }
    setTreeStep(0)
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
            <button className="account-top-button" type="button" onClick={openAccount}>{session ? `☁ ${session.user.email ?? 'Account'}` : '☁ Sign in & sync'}</button>
            <button className="top-home-button" type="button" onClick={() => setPage('home')}>← Home</button>
          </div>
        </header>

        <div className="workspace-layout">
          <aside className="workspace-sidebar">
            <div className="side-label">WORKSPACE</div>
            <button className="side-link side-link-active" type="button"><span>⌘</span> Code Editor</button>
            <button className={`side-link ${activeTab === 'teacher' ? 'side-link-active' : ''}`} type="button" onClick={openTeacher}><span>✦</span> AI Code Teacher</button>
            <button className={`side-link ${activeTab === 'visualizer' ? 'side-link-active' : ''}`} type="button" onClick={openVisualizer}><span>◇</span> Code Visualizer</button>
            <button className={`side-link ${activeTab === 'arrays' ? 'side-link-active' : ''}`} type="button" onClick={openArrayLab}><span>♧</span> Array Lab</button>
            <button className={`side-link ${activeTab === 'linear' ? 'side-link-active' : ''}`} type="button" onClick={openStackQueue}><span>⇅</span> Stack &amp; Queue</button>
            <button className={`side-link ${activeTab === 'linked' ? 'side-link-active' : ''}`} type="button" onClick={openLinkedList}><span>↗</span> Linked List</button>
            <button className={`side-link ${activeTab === 'tree' ? 'side-link-active' : ''}`} type="button" onClick={openTreeLab}><span>🌳</span> Binary Tree</button>
            <button className={`side-link ${activeTab === 'quiz' ? 'side-link-active' : ''}`} type="button" onClick={openQuiz}><span>📝</span> C++ Quiz Center</button>
            <button className={`side-link ${activeTab === 'challenge' ? 'side-link-active' : ''}`} type="button" onClick={openChallengeArena}><span>🏁</span> Coding Challenges</button>
            <button className={`side-link ${activeTab === 'progress' ? 'side-link-active' : ''}`} type="button" onClick={openProgress}><span>📊</span> My Progress</button>
            <button className={`side-link ${activeTab === 'snippets' ? 'side-link-active' : ''}`} type="button" onClick={openSnippets}><span>📚</span> Snippet Library</button>
            <button className={`side-link ${activeTab === 'account' ? 'side-link-active' : ''}`} type="button" onClick={openAccount}><span>☁</span> Account &amp; Sync</button>
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
                <button type="button" className={activeTab === 'tree' ? 'output-tab active' : 'output-tab'} onClick={openTreeLab}>🌳 Binary Tree</button>
                <button type="button" className={activeTab === 'teacher' ? 'output-tab active' : 'output-tab'} onClick={openTeacher}>✦ AI Teacher</button>
                <button type="button" className={activeTab === 'quiz' ? 'output-tab active' : 'output-tab'} onClick={openQuiz}>📝 Quiz</button>
                <button type="button" className={activeTab === 'challenge' ? 'output-tab active' : 'output-tab'} onClick={openChallengeArena}>🏁 Challenges</button>
                <button type="button" className={activeTab === 'progress' ? 'output-tab active' : 'output-tab'} onClick={openProgress}>📊 Progress</button>
                <button type="button" className={activeTab === 'snippets' ? 'output-tab active' : 'output-tab'} onClick={openSnippets}>📚 Snippets</button>
                <button type="button" className={activeTab === 'account' ? 'output-tab active' : 'output-tab'} onClick={openAccount}>☁ Account</button>
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
              ) : activeTab === 'linked' ? (
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
              ) : activeTab === 'challenge' ? (
                <div className="challenge-panel">
                  <div className="challenge-heading">
                    <div>
                      <div className="challenge-kicker">PRACTICE LIKE A PROGRAMMER</div>
                      <strong>Coding Challenge Arena</strong>
                      <p>Choose a problem, write your solution in the editor above, and pass the test cases before time runs out.</p>
                    </div>
                    <label className="challenge-filter">Difficulty
                      <select value={challengeDifficulty} onChange={(event) => changeChallengeDifficulty(event.target.value as 'All levels' | ChallengeDifficulty)}>
                        <option>All levels</option>
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                      </select>
                    </label>
                  </div>

                  <div className="challenge-layout">
                    <div className="challenge-list">
                      <div className="challenge-list-title">CHOOSE A CHALLENGE <span>{visibleChallenges.length} available</span></div>
                      {visibleChallenges.map((challenge) => (
                        <button type="button" key={challenge.id} className={`challenge-list-item ${selectedChallengeId === challenge.id ? 'challenge-list-item-active' : ''}`} onClick={() => selectCodingChallenge(challenge)}>
                          <span className={`challenge-level-dot challenge-level-${challenge.difficulty.toLowerCase()}`} />
                          <span className="challenge-list-copy"><strong>{challenge.title}</strong><small>{challenge.topic} · {challenge.minutes} min</small></span>
                          <span className="challenge-list-arrow">›</span>
                        </button>
                      ))}
                    </div>

                    <div className="challenge-detail">
                      <div className="challenge-problem-top">
                        <div>
                          <div className="challenge-badges">
                            <span className={`challenge-difficulty challenge-difficulty-${selectedChallenge.difficulty.toLowerCase()}`}>{selectedChallenge.difficulty}</span>
                            <span className="challenge-topic">{selectedChallenge.topic}</span>
                          </div>
                          <h3>{selectedChallenge.title}</h3>
                          <p>{selectedChallenge.description}</p>
                        </div>
                        <div className={`challenge-clock ${challengeSecondsLeft === 0 && !challengeTimerRunning ? 'challenge-clock-idle' : ''}`}>
                          <small>TIME LEFT</small>
                          <strong>{formatChallengeTime(challengeSecondsLeft)}</strong>
                          <span>{challengeTimerRunning ? 'Timer running' : challengeSecondsLeft === 0 ? 'Time expired' : 'Ready to start'}</span>
                        </div>
                      </div>

                      <div className="challenge-instructions">
                        <strong>What your program must do</strong>
                        <ul>{selectedChallenge.requirements.map((requirement, index) => <li key={index}>{requirement}</li>)}</ul>
                      </div>

                      <div className="challenge-samples">
                        <div><span>SAMPLE INPUT</span><pre>{selectedChallenge.sampleInput}</pre></div>
                        <div><span>EXPECTED OUTPUT</span><pre>{selectedChallenge.sampleOutput}</pre></div>
                      </div>

                      <div className="challenge-hint"><span>💡 Hint</span><p>{selectedChallenge.hint}</p></div>

                      <div className="challenge-actions">
                        <button type="button" className="challenge-secondary-button" onClick={startCodingChallenge}>↻ Load starter &amp; start</button>
                        <button type="button" className="challenge-secondary-button" onClick={resetCodingChallenge}>Reset</button>
                        <button type="button" className="challenge-submit-button" onClick={submitCodingChallenge} disabled={!challengeTimerRunning || challengeChecking || challengeSecondsLeft === 0}>{challengeChecking ? '◌ Checking…' : `▶ Run ${selectedChallenge.tests.length} tests`}</button>
                      </div>

                      <div className={`challenge-status ${challengeStatus.startsWith('All ') ? 'challenge-status-success' : ''}`}>{challengeStatus}</div>
                      {challengeTestResults.length > 0 && (
                        <div className="challenge-results">
                          <div className="challenge-results-heading"><strong>Test results</strong><span>{challengePassedCount}/{challengeTestResults.length} passed</span></div>
                          {challengeTestResults.map((result) => (
                            <div className={`challenge-test-row ${result.passed ? 'challenge-test-passed' : 'challenge-test-failed'}`} key={result.index}>
                              <div><strong>{result.passed ? '✓' : '×'} Test {result.index}</strong><span>{result.passed ? 'Passed' : 'Failed'}</span></div>
                              {result.error ? <small>{result.error}</small> : <small>Expected: {result.expected} · Your output: {result.actual.trim() || '(no output)'}</small>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="challenge-credit-note">Each test case runs your current C++ code once through the JDoodle compiler. A submission with 3 test cases uses 3 compiler runs.</div>
                </div>
              ) : activeTab === 'snippets' ? (
                <div className="snippets-panel">
                  <div className="snippets-heading">
                    <div>
                      <div className="snippets-kicker">YOUR REUSABLE C++ TOOLBOX</div>
                      <strong>Snippet Library</strong>
                      <p>Browse examples, copy useful patterns or load a snippet straight into the editor.</p>
                    </div>
                    <span className="snippets-count">{builtInSnippets.length + personalSnippets.length} snippets</span>
                  </div>

                  <div className="snippets-toolbar">
                    <label className="snippets-search">
                      <span>⌕</span>
                      <input value={snippetSearch} onChange={(event) => setSnippetSearch(event.target.value)} placeholder="Search snippets, topics or concepts…" />
                    </label>
                    <label className="snippets-category-select">Filter
                      <select value={snippetCategory} onChange={(event) => setSnippetCategory(event.target.value as SnippetCategory)}>
                        <option value="All snippets">All snippets</option>
                        <option value="Basics">Basics</option>
                        <option value="Control Flow">Control Flow</option>
                        <option value="Loops">Loops</option>
                        <option value="Functions">Functions</option>
                        <option value="Arrays">Arrays</option>
                        <option value="Data Structures">Data Structures</option>
                        <option value="My Snippets">My Snippets</option>
                      </select>
                    </label>
                  </div>

                  <div className="snippets-layout">
                    <div className="snippets-list">
                      <div className="snippets-list-heading"><strong>Examples</strong><span>{visibleSnippets.length} found</span></div>
                      {visibleSnippets.length === 0 ? (
                        <div className="snippets-no-results"><span>⌕</span><strong>No snippets found</strong><p>Try another search or choose a different category.</p></div>
                      ) : visibleSnippets.map((snippet) => (
                        <button type="button" key={snippet.id} className={`snippet-list-item ${selectedSnippet?.id === snippet.id ? 'snippet-list-item-active' : ''}`} onClick={() => setSelectedSnippetId(snippet.id)}>
                          <span className="snippet-item-icon">{snippet.personal ? '★' : '⌘'}</span>
                          <span className="snippet-item-copy"><strong>{snippet.title}</strong><small>{snippet.category}{snippet.personal ? ' · Saved' : ''}</small></span>
                          <span className="snippet-item-arrow">›</span>
                        </button>
                      ))}
                    </div>

                    {selectedSnippet ? (
                      <div className="snippet-detail">
                        <div className="snippet-detail-heading">
                          <div><span>{selectedSnippet.category.toUpperCase()}{selectedSnippet.personal ? ' · YOUR SNIPPET' : ' · BUILT-IN'}</span><strong>{selectedSnippet.title}</strong><p>{selectedSnippet.description}</p></div>
                          <div className="snippet-detail-actions">
                            <button type="button" onClick={() => copySnippet(selectedSnippet)}>Copy code</button>
                            <button type="button" className="snippet-insert-button" onClick={() => insertSnippet(selectedSnippet)}>Insert into editor ↗</button>
                          </div>
                        </div>
                        <pre className="snippet-code-preview" tabIndex={0}><code>{selectedSnippet.code}</code></pre>
                        {selectedSnippet.personal && <button type="button" className="snippet-delete-button" onClick={() => deletePersonalSnippet(selectedSnippet)}>Delete this saved snippet</button>}
                      </div>
                    ) : (
                      <div className="snippet-detail snippet-detail-empty"><span>📚</span><strong>Select a snippet to preview it.</strong></div>
                    )}
                  </div>

                  <div className="snippet-save-card">
                    <div><span className="snippet-save-icon">＋</span><div><strong>Save your current code</strong><p>Store the code in the editor as a personal snippet for later use.</p></div></div>
                    <div className="snippet-save-fields">
                      <input value={snippetTitle} onChange={(event) => setSnippetTitle(event.target.value)} maxLength={60} placeholder="Snippet title (e.g. My sorting example)" />
                      <select value={snippetSaveCategory} onChange={(event) => setSnippetSaveCategory(event.target.value as Exclude<SnippetCategory, 'All snippets' | 'My Snippets'>)}>
                        <option value="Basics">Basics</option><option value="Control Flow">Control Flow</option><option value="Loops">Loops</option><option value="Functions">Functions</option><option value="Arrays">Arrays</option><option value="Data Structures">Data Structures</option>
                      </select>
                      <button type="button" onClick={saveCurrentSnippet}>Save current code</button>
                    </div>
                  </div>
                  <div className="snippets-notice"><span>🔒</span> {snippetNotice} Personal snippets stay on this browser unless you sign in and enable your private Supabase sync. They are never sent to Ollama or JDoodle.</div>
                </div>
              ) : activeTab === 'account' ? (
                <div className="account-panel">
                  <div className="account-heading">
                    <div>
                      <div className="account-kicker">YOUR CODELENS ACCOUNT</div>
                      <strong>Sign in &amp; sync</strong>
                      <p>Keep your personal snippets and learning progress connected to your account on different devices.</p>
                    </div>
                    <span className="account-cloud-icon">☁</span>
                  </div>

                  {!supabaseConfigured ? (
                    <div className="account-setup-card">
                      <span className="account-setup-icon">⚙</span>
                      <div>
                        <strong>Connect your Supabase project first</strong>
                        <p>Install the Supabase client, add your Project URL and public publishable key to <code>.env.local</code>, then run the SQL setup included with this update.</p>
                      </div>
                    </div>
                  ) : session ? (
                    <div className="account-signed-in-card">
                      <div className="account-profile-row">
                        <span className="account-avatar">{(session.user.email || 'U').slice(0, 1).toUpperCase()}</span>
                        <div><strong>{session.user.email}</strong><small>Signed in to CodeLens AI</small></div>
                        <span className={`cloud-status-pill ${cloudStatus}`}>{cloudStatus === 'synced' ? '● Synced' : cloudStatus === 'syncing' ? '◌ Syncing' : cloudStatus === 'loading' ? '◌ Loading' : cloudStatus === 'error' ? '● Attention' : '● Local'}</span>
                      </div>
                      <div className="account-sync-summary">
                        <div><span>PERSONAL SNIPPETS</span><strong>{personalSnippets.length}</strong></div>
                        <div><span>LEARNING RECORDS</span><strong>{progressRecords.length}</strong></div>
                      </div>
                      <div className="account-sync-copy">
                        <strong>{cloudStatus === 'synced' ? 'Your cloud data is up to date.' : cloudStatus === 'syncing' ? 'Saving your latest changes…' : cloudStatus === 'loading' ? 'Loading your account data…' : cloudStatus === 'error' ? 'Cloud sync needs attention.' : 'Waiting for cloud sync setup.'}</strong>
                        <span>{lastCloudSync ? `Last sync: ${new Date(lastCloudSync).toLocaleString()}` : 'Your changes are also kept in this browser.'}</span>
                      </div>
                      <div className="account-actions">
                        <button type="button" className="account-sync-button" onClick={syncCloudNow} disabled={cloudStatus === 'loading' || cloudStatus === 'syncing'}>↻ Sync now</button>
                        <button type="button" className="account-signout-button" onClick={signOutAccount} disabled={authBusy}>Sign out</button>
                      </div>
                    </div>
                  ) : (
                    <div className="account-auth-card">
                      <div className="account-mode-switch">
                        <button type="button" className={authMode === 'signin' ? 'active' : ''} onClick={() => { setAuthMode('signin'); setAccountNotice('Sign in to sync your saved snippets and learning progress across devices.') }}>Sign in</button>
                        <button type="button" className={authMode === 'signup' ? 'active' : ''} onClick={() => { setAuthMode('signup'); setAccountNotice('Create an account with your email and a password of at least 6 characters.') }}>Create account</button>
                      </div>
                      <form className="account-auth-form" onSubmit={submitAccountAuth}>
                        <label>Email address<input type="email" autoComplete="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" /></label>
                        <label>Password<input type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={6} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 6 characters" /></label>
                        <button type="submit" className="account-sync-button" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'signup' ? 'Create my account' : 'Sign in securely'}</button>
                      </form>
                      <p className="account-auth-footnote">Your email and password are handled by Supabase Auth. CodeLens never stores your password in its own database.</p>
                    </div>
                  )}

                  {accountNotice && <div className={`account-notice ${cloudStatus === 'error' ? 'account-notice-warning' : ''}`} role="status">{accountNotice}</div>}
                  <div className="account-security-note"><span>🔐</span><div><strong>Private to your account</strong><p>Row Level Security makes each account access only its own saved snippets and learning history. Your C++ editor contents and AI Teacher conversations are not included in cloud sync.</p></div></div>
                </div>
              ) : activeTab === 'progress' ? (
                <div className="progress-panel">
                  <div className="progress-heading">
                    <div>
                      <div className="progress-kicker">YOUR LEARNING JOURNEY</div>
                      <strong>Learning Progress</strong>
                      <p>Track finished quizzes and fully solved coding challenges. Your history is saved in this browser.</p>
                    </div>
                    <button type="button" className="progress-clear-button" onClick={clearProgress} disabled={progressRecords.length === 0}>Clear history</button>
                  </div>

                  <div className="progress-stat-grid">
                    <article className="progress-stat-card"><span>QUIZ ATTEMPTS</span><strong>{progressSummary.quizAttempts}</strong><small>Completed quizzes</small></article>
                    <article className="progress-stat-card"><span>CHALLENGES SOLVED</span><strong>{progressSummary.solvedChallenges}</strong><small>{progressSummary.challengeAttempts} successful submissions</small></article>
                    <article className="progress-stat-card"><span>QUIZ ACCURACY</span><strong>{progressSummary.quizAccuracy === null ? '—' : `${progressSummary.quizAccuracy}%`}</strong><small>Across completed quizzes</small></article>
                    <article className="progress-stat-card"><span>LEARNING STREAK</span><strong>{progressSummary.streak}<em> days</em></strong><small>Consecutive active days</small></article>
                  </div>

                  {progressRecords.length === 0 ? (
                    <div className="progress-empty-state">
                      <span>📈</span>
                      <strong>Your progress will appear here.</strong>
                      <p>Complete a quiz or pass every test in a coding challenge. Your scores and activity will be collected automatically.</p>
                      <div><button type="button" onClick={openQuiz}>Start a quiz</button><button type="button" onClick={openChallengeArena}>Try a challenge</button></div>
                    </div>
                  ) : (
                    <div className="progress-dashboard-grid">
                      <section className="progress-section-card">
                        <div className="progress-section-heading"><div><strong>Topic performance</strong><span>Accuracy from your completed activities</span></div><b>{progressSummary.topicStats.length} topics</b></div>
                        <div className="progress-topic-list">
                          {progressSummary.topicStats.map((item) => (
                            <div className="progress-topic-row" key={item.topic}>
                              <div className="progress-topic-meta"><strong>{item.topic}</strong><span>{item.accuracy}% · {item.attempts} {item.attempts === 1 ? 'activity' : 'activities'}</span></div>
                              <div className="progress-bar-track"><span style={{ width: `${item.accuracy}%` }} /></div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="progress-section-card">
                        <div className="progress-section-heading"><div><strong>Recent activity</strong><span>Your latest completed work</span></div><b>{progressRecords.length} saved</b></div>
                        <div className="progress-activity-list">
                          {progressRecords.slice(0, 8).map((record) => (
                            <article className="progress-activity-item" key={record.id}>
                              <span className={`progress-activity-icon ${record.kind === 'Quiz' ? 'progress-icon-quiz' : 'progress-icon-challenge'}`}>{record.kind === 'Quiz' ? '📝' : '🏁'}</span>
                              <div className="progress-activity-copy"><strong>{record.title}</strong><small>{record.kind}{record.difficulty ? ` · ${record.difficulty}` : ''} · {new Date(record.completedAt).toLocaleDateString()}</small></div>
                              <b>{record.score}/{record.total}</b>
                            </article>
                          ))}
                        </div>
                      </section>
                    </div>
                  )}
                  <div className="progress-privacy-note"><span>🔒</span> Learning progress is stored on this browser and can sync to your private Supabase account when you sign in. It is not sent to Ollama or JDoodle.</div>
                </div>
              ) : activeTab === 'quiz' ? (
                <div className="quiz-panel">
                  <div className="quiz-heading">
                    <div>
                      <div className="quiz-kicker">PRACTICE & CHECK YOUR KNOWLEDGE</div>
                      <strong>C++ Quiz Center</strong>
                      <p>Choose a topic, answer each question and read the explanation immediately.</p>
                    </div>
                    <label className="quiz-topic-select">Quiz topic
                      <select value={quizTopic} onChange={(event) => changeQuizTopic(event.target.value as QuizTopic)}>
                        <option value="All topics">All topics · 15 questions</option>
                        <option value="C++ Basics">C++ Basics · 5 questions</option>
                        <option value="Control Flow">Control Flow · 5 questions</option>
                        <option value="Data Structures">Data Structures · 5 questions</option>
                      </select>
                    </label>
                  </div>

                  <div className="quiz-stats">
                    <div><span>QUESTIONS</span><strong>{quizQuestionsForTopic.length}</strong></div>
                    <div><span>ANSWERED</span><strong>{quizAnsweredCount}</strong></div>
                    <div><span>CORRECT</span><strong>{quizScore}</strong></div>
                    <div><span>PROGRESS</span><strong>{Math.round(quizProgress)}%</strong></div>
                  </div>
                  <div className="quiz-progress-track"><span style={{ width: `${quizProgress}%` }} /></div>

                  {quizFinished ? (
                    <div className="quiz-results">
                      <div className="quiz-result-summary">
                        <div className="quiz-score-ring"><strong>{Math.round((quizScore / quizQuestionsForTopic.length) * 100)}%</strong><span>YOUR SCORE</span></div>
                        <div>
                          <div className="quiz-kicker">QUIZ COMPLETE</div>
                          <h3>{quizScore} out of {quizQuestionsForTopic.length} correct</h3>
                          <p>{quizScore === quizQuestionsForTopic.length ? 'Excellent work! You got every answer right.' : quizScore >= Math.ceil(quizQuestionsForTopic.length * 0.6) ? 'Good effort! Review the explanations to strengthen your concepts.' : 'Keep practicing. Read the explanations and try the quiz again.'}</p>
                          <button type="button" className="quiz-primary-button" onClick={restartQuiz}>↺ Try again</button>
                        </div>
                      </div>
                      <div className="quiz-review-heading"><strong>Answer review</strong><span>Correct answers and explanations</span></div>
                      <div className="quiz-review-list">
                        {quizQuestionsForTopic.map((question, index) => {
                          const selected = quizAnswers[question.id]
                          const isCorrect = selected === question.correct
                          return (
                            <article className="quiz-review-item" key={question.id}>
                              <div className="quiz-review-top"><strong>Q{index + 1}. {question.question}</strong><span className={isCorrect ? 'quiz-review-correct' : 'quiz-review-wrong'}>{isCorrect ? 'Correct' : 'Review'}</span></div>
                              <p>Your answer: {selected === undefined ? 'Not answered' : question.options[selected]}</p>
                              <p>Correct answer: <b>{question.options[question.correct]}</b></p>
                              <small>{question.explanation}</small>
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  ) : currentQuizQuestion ? (
                    <div className="quiz-question-card">
                      <div className="quiz-question-meta"><span>{currentQuizQuestion.topic}</span><strong>QUESTION {quizIndex + 1} / {quizQuestionsForTopic.length}</strong></div>
                      <h3>{currentQuizQuestion.question}</h3>
                      <div className="quiz-options">
                        {currentQuizQuestion.options.map((option, index) => {
                          const selected = quizAnswers[currentQuizQuestion.id]
                          const isAnswered = selected !== undefined
                          const optionClass = !isAnswered ? '' : index === currentQuizQuestion.correct ? ' quiz-option-correct' : index === selected ? ' quiz-option-wrong' : ''
                          return (
                            <button key={`${currentQuizQuestion.id}-${index}`} type="button" className={`quiz-option${optionClass}`} onClick={() => answerQuizQuestion(index)} disabled={isAnswered}>
                              <span className="quiz-option-letter">{String.fromCharCode(65 + index)}</span>
                              <span>{option}</span>
                              {isAnswered && index === currentQuizQuestion.correct && <b>✓</b>}
                              {isAnswered && index === selected && index !== currentQuizQuestion.correct && <b>×</b>}
                            </button>
                          )
                        })}
                      </div>
                      {quizAnswers[currentQuizQuestion.id] !== undefined && (
                        <div className={`quiz-feedback ${quizAnswers[currentQuizQuestion.id] === currentQuizQuestion.correct ? 'quiz-feedback-correct' : 'quiz-feedback-wrong'}`}>
                          <strong>{quizAnswers[currentQuizQuestion.id] === currentQuizQuestion.correct ? '✓ That is correct!' : '✕ Not quite. Here is the correct answer.'}</strong>
                          <p>{currentQuizQuestion.explanation}</p>
                        </div>
                      )}
                      <div className="quiz-navigation">
                        <button type="button" className="quiz-secondary-button" onClick={() => setQuizIndex((index) => Math.max(0, index - 1))} disabled={quizIndex === 0}>← Previous</button>
                        <span>{quizAnsweredCount} of {quizQuestionsForTopic.length} answered</span>
                        <button type="button" className="quiz-primary-button" onClick={moveToNextQuizQuestion} disabled={quizAnswers[currentQuizQuestion.id] === undefined}>
                          {quizIndex === quizQuestionsForTopic.length - 1 ? 'Finish quiz ✓' : 'Next question →'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="quiz-empty">No questions are available for this topic.</div>
                  )}
                  <div className="quiz-learning-note"><span>✦</span> This quiz is built into CodeLens AI. Your answers stay in this browser session and are not sent to Ollama or JDoodle.</div>
                </div>
              ) : activeTab === 'teacher' ? (
                <div className="teacher-panel">
                  <div className="teacher-heading">
                    <div>
                      <div className="teacher-kicker">YOUR LOCAL AI TUTOR</div>
                      <strong>AI Code Teacher</strong>
                      <p>Ask questions about your current C++ code and learn one concept at a time.</p>
                    </div>
                    <div className="teacher-heading-actions">
                      <label className="teacher-language">Explanation language
                        <select value={language} onChange={(event) => setLanguage(event.target.value as 'English' | 'Roman Urdu')}>
                          <option value="English">English</option>
                          <option value="Roman Urdu">Roman Urdu</option>
                        </select>
                      </label>
                      <button type="button" className="teacher-clear" onClick={clearTeacherChat}>Clear chat</button>
                    </div>
                  </div>

                  <div className="teacher-quick-prompts">
                    <button type="button" disabled={isTeaching} onClick={() => askTeacher('Explain my current code step by step, including the important lines and variables.')}>✦ Explain this code</button>
                    <button type="button" disabled={isTeaching} onClick={() => askTeacher('Review my current code for mistakes, bugs, and possible improvements. Explain how to fix each issue.')}>🐞 Find mistakes</button>
                    <button type="button" disabled={isTeaching} onClick={() => askTeacher('Give me one beginner-friendly C++ practice question based on the concepts in my current code. Do not reveal the solution unless I ask.')}>✎ Give me practice</button>
                  </div>

                  <div className="teacher-chat" aria-live="polite">
                    {teacherMessages.length === 0 ? (
                      <div className="teacher-empty">
                        <span>✦</span>
                        <strong>Let's understand your code.</strong>
                        <p>Choose a quick prompt above or ask your own question below. Your current editor code is included as context.</p>
                      </div>
                    ) : teacherMessages.map((message, index) => (
                      <div key={`${index}-${message.role}`} className={`teacher-message ${message.role === 'user' ? 'teacher-message-user' : 'teacher-message-ai'}`}>
                        <span className="teacher-message-role">{message.role === 'user' ? 'YOU' : 'CODELENS AI'}</span>
                        <p>{message.content}</p>
                      </div>
                    ))}
                    {isTeaching && <div className="teacher-thinking"><span className="teacher-spinner" /> Thinking with your local model…</div>}
                  </div>

                  {teacherError && <div className="teacher-error">{teacherError}</div>}
                  <form className="teacher-compose" onSubmit={(event) => { event.preventDefault(); void askTeacher() }}>
                    <textarea value={teacherQuestion} onChange={(event) => setTeacherQuestion(event.target.value)} placeholder="Ask anything about C++ or your current code…" rows={3} disabled={isTeaching} />
                    <button type="submit" disabled={isTeaching || !teacherQuestion.trim()}>{isTeaching ? 'Thinking…' : 'Ask Teacher ↗'}</button>
                  </form>
                  <div className="teacher-privacy"><span>●</span> AI explanations run through Ollama on this PC. Run Code still uses the JDoodle cloud compiler.</div>
                </div>
              ) : (
                <div className="tree-lab-panel">
                  <div className="tree-lab-heading">
                    <div>
                      <div className="tree-lab-kicker">DATA STRUCTURES LAB</div>
                      <strong>Binary Tree Visualizer</strong>
                      <p>Build a binary tree and explore its traversal orders, one node at a time.</p>
                    </div>
                    <span className="tree-lab-badge">MAX 4 LEVELS</span>
                  </div>

                  <div className="tree-configuration">
                    <label className="tree-field tree-values-field">
                      <span>Level-order node values (comma separated)</span>
                      <input value={treeValuesInput} onChange={(event) => setTreeValuesInput(event.target.value)} placeholder="50, 30, 70, 20, 40, 60, 80" />
                    </label>
                    <label className="tree-field">
                      <span>Traversal / operation</span>
                      <select value={treeTraversal} onChange={(event) => setTreeTraversal(event.target.value as TreeOperation)}>
                        <option value="preorder">Preorder</option>
                        <option value="inorder">Inorder</option>
                        <option value="postorder">Postorder</option>
                        <option value="levelorder">Level Order</option>
                        <option value="search">Search value</option>
                      </select>
                    </label>
                    {treeTraversal === 'search' && (
                      <label className="tree-field">
                        <span>Value to search</span>
                        <input type="number" value={treeTargetInput} onChange={(event) => setTreeTargetInput(event.target.value)} />
                      </label>
                    )}
                    <button className="tree-build-button" type="button" onClick={buildTreeAnimation}>Build tree <span>→</span></button>
                  </div>

                  {treeError && <div className="tree-error" role="alert">{treeError}</div>}

                  <div className="tree-stage">
                    <div className="tree-stage-top">
                      <span>{currentTreeFrame.label}</span>
                      <strong>STEP {treeStep + 1} / {treeFrames.length}</strong>
                    </div>
                    <div className="tree-progress"><span style={{ width: `${((treeStep + 1) / treeFrames.length) * 100}%` }} /></div>

                    <div className="tree-canvas">
                      <svg className="tree-edges" viewBox="0 0 700 330" preserveAspectRatio="xMidYMid meet" aria-label="Binary tree connecting edges">
                        {treeNodes.map((node) => {
                          const level = Math.floor(Math.log2(node.id + 1))
                          const first = 2 ** level - 1
                          const position = node.id - first
                          const count = 2 ** level
                          const x = ((position + 0.5) / count) * 700
                          const y = 42 + level * 88
                          return (
                            <g key={`edge-${node.id}`}>
                              {node.left !== null && (() => {
                                const childLevel = level + 1
                                const childPosition = node.left - (2 ** childLevel - 1)
                                const childCount = 2 ** childLevel
                                const childX = ((childPosition + 0.5) / childCount) * 700
                                return <line x1={x} y1={y + 25} x2={childX} y2={y + 88 - 25} />
                              })()}
                              {node.right !== null && (() => {
                                const childLevel = level + 1
                                const childPosition = node.right - (2 ** childLevel - 1)
                                const childCount = 2 ** childLevel
                                const childX = ((childPosition + 0.5) / childCount) * 700
                                return <line x1={x} y1={y + 25} x2={childX} y2={y + 88 - 25} />
                              })()}
                            </g>
                          )
                        })}
                      </svg>
                      <div className="tree-node-layer">
                        {treeNodes.map((node) => {
                          const level = Math.floor(Math.log2(node.id + 1))
                          const first = 2 ** level - 1
                          const position = node.id - first
                          const count = 2 ** level
                          const x = ((position + 0.5) / count) * 100
                          const y = 42 + level * 88
                          const visited = currentTreeFrame.visited.includes(node.id)
                          const active = currentTreeFrame.activeId === node.id
                          return (
                            <div
                              key={node.id}
                              className={`tree-node ${visited ? 'tree-node-visited' : ''} ${active ? 'tree-node-active' : ''}`}
                              style={{ left: `${x}%`, top: `${y}px` }}
                            >
                              {node.value}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="tree-stage-message"><span>✦</span><p>{currentTreeFrame.message}</p></div>

                    <div className="tree-output">
                      <strong>TRAVERSAL OUTPUT</strong>
                      <div>{currentTreeFrame.output.length
                        ? currentTreeFrame.output.map((value, index) => <span key={`${index}-${value}`} className="tree-output-value">{value}</span>)
                        : <span className="tree-output-empty">No nodes visited yet.</span>}</div>
                    </div>

                    <div className="tree-controls">
                      <button type="button" disabled={treeStep === 0} onClick={() => setTreeStep(0)}>↺ Restart</button>
                      <div>
                        <button type="button" disabled={treeStep === 0} onClick={() => setTreeStep((step) => Math.max(0, step - 1))}>← Previous</button>
                        <button className="tree-next-button" type="button" disabled={treeStep >= treeFrames.length - 1} onClick={() => setTreeStep((step) => Math.min(treeFrames.length - 1, step + 1))}>Next step →</button>
                      </div>
                    </div>
                  </div>

                  <div className="tree-learning-note">
                    <strong>How the tree is built</strong>
                    <span>Values are placed in level order: the first value is the root, then left and right children, followed by the next level. This is a general binary tree, not a Binary Search Tree.</span>
                  </div>
                </div>
              )}
            </section>

            <div className="editor-note"><span>🔒</span> Code is sent to the remote compiler only when you press Run. Personal snippets and learning progress can sync privately through your Supabase account.</div>
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

      <footer className="footer section-wrap"><button className="brand brand-button" type="button" onClick={() => setPage('home')}><span className="brand-mark"><span /></span><span className="brand-name">CodeLens<span>AI</span></span></button><p>Understand code. Visualize logic. Keep growing.</p><span>© 2026 CodeLens AI · Learning, made clearer.</span><span>Created by Wajid Hameed</span></footer>
    </div>
  )
}

export default App
