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

const featureCards = [
  { icon: '🧠', number: '01', title: 'AI Code Teacher', text: 'Understand tricky code with friendly, step-by-step explanations.', tone: 'lavender' },
  { icon: '🎬', number: '02', title: 'Visual Code Steps', text: 'Follow variables and program logic as each line is explored.', tone: 'peach' },
  { icon: '🌳', number: '03', title: 'Data Structures Lab', text: 'Explore arrays, stacks, queues, linked lists and trees.', tone: 'mint' },
  { icon: '🐞', number: '04', title: 'Friendly Debugging', text: 'Learn what an error means and how to approach fixing it.', tone: 'blue' },
]

function App() {
  const [page, setPage] = useState<'home' | 'editor'>('home')
  const [code, setCode] = useState(starterCode)
  const [activeTab, setActiveTab] = useState<'output' | 'help'>('output')
  const [notice, setNotice] = useState('Your code is ready to edit.')
  const [copied, setCopied] = useState(false)

  const lines = useMemo(() => code.split('\n').length, [code])
  const words = useMemo(() => code.trim() ? code.trim().split(/\s+/).length : 0, [code])

  const openEditor = () => {
    setPage('editor')
    setNotice('Your code is ready to edit.')
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
    setNotice('Starter C++ example restored.')
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
            <span className="saved-indicator"><i /> Local editor</span>
            <button className="top-home-button" type="button" onClick={() => setPage('home')}>← Home</button>
          </div>
        </header>

        <div className="workspace-layout">
          <aside className="workspace-sidebar">
            <div className="side-label">WORKSPACE</div>
            <button className="side-link side-link-active" type="button"><span>⌘</span> Code Editor</button>
            <button className="side-link" type="button" onClick={() => setNotice('The AI Code Teacher will be connected in the next development phase.')}><span>✦</span> AI Code Teacher <em>SOON</em></button>
            <button className="side-link" type="button" onClick={() => setNotice('The visualizer is planned for the next phase.')}><span>◇</span> Code Visualizer <em>SOON</em></button>
            <button className="side-link" type="button" onClick={() => setNotice('The Data Structures Lab is planned for a later phase.')}><span>♧</span> DSA Lab <em>SOON</em></button>
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
                  <button type="button" className="run-button" onClick={() => { setActiveTab('output'); setNotice('The editor is ready. C++ compiler connection is the next development step; this button does not execute code yet.') }}>▶ Run code</button>
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

            <section className="output-card">
              <div className="output-tabs">
                <button type="button" className={activeTab === 'output' ? 'output-tab active' : 'output-tab'} onClick={() => setActiveTab('output')}>▣ Output</button>
                <button type="button" className={activeTab === 'help' ? 'output-tab active' : 'output-tab'} onClick={() => setActiveTab('help')}>✦ Code overview</button>
                <span className="output-coming">Compiler not connected yet</span>
              </div>
              {activeTab === 'output' ? (
                <div className="output-content">
                  <div className="terminal-icon">›_</div>
                  <div><strong>Ready when you are.</strong><p>{notice}</p></div>
                </div>
              ) : (
                <div className="overview-content">
                  <div><strong>{lines}</strong><span>Lines of code</span></div>
                  <div><strong>{words}</strong><span>Words / tokens</span></div>
                  <div><strong>{(code.match(/\bint\b/g) || []).length}</strong><span>Integer declarations</span></div>
                  <p>This is a basic local code overview. AI explanations and real C++ execution will be connected in upcoming phases.</p>
                </div>
              )}
            </section>

            <div className="editor-note"><span>🔒</span> Your code is currently kept in this browser session. Saving projects to your account will be added with Supabase.</div>
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
