import { useState } from 'react'
import './App.css'

const features = [
  { n: '01', icon: '🧠', title: 'AI Code Teacher', text: 'Get friendly, step-by-step explanations in simple English or Roman Urdu.', tone: 'lavender' },
  { n: '02', icon: '🎬', title: 'Visual Code Steps', text: 'Watch variables change and follow the logic as your program runs.', tone: 'peach' },
  { n: '03', icon: '🌳', title: 'Data Structures Lab', text: 'Explore arrays, stacks, queues, linked lists and trees visually.', tone: 'mint' },
  { n: '04', icon: '🐞', title: 'Friendly Debugging', text: 'Understand what went wrong, why it happened and how to fix it.', tone: 'blue' },
]

const demoSteps = [
  { code: 'int a = 10;', note: 'A variable named a is created and stores the value 10.', roman: 'Yahan a naam ka variable banta hai aur is mein 10 store hota hai.' },
  { code: 'int b = 20;', note: 'A second variable named b is created and stores the value 20.', roman: 'Ab b naam ka doosra variable banta hai aur is mein 20 store hota hai.' },
  { code: 'int sum = a + b;', note: 'The program adds a and b, then stores the result 30 in sum.', roman: 'Program a aur b ko add karta hai aur result 30 ko sum mein save karta hai.' },
  { code: 'cout << sum;', note: 'The value stored in sum is printed to the output.', roman: 'Aakhir mein sum ki value output screen par print hoti hai.' },
]

function App() {
  const [step, setStep] = useState(0)
  const [language, setLanguage] = useState<'English' | 'Roman Urdu'>('English')
  const [menuOpen, setMenuOpen] = useState(false)
  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <div className="site-shell" id="home">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="#home"><span className="brand-mark"><span /></span><span className="brand-name">CodeLens<span>AI</span></span></a>
        <button className="mobile-menu" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
        <nav className={menuOpen ? 'nav-links nav-open' : 'nav-links'}>
          <button onClick={() => goTo('features')}>Features</button><button onClick={() => goTo('how')}>How it works</button><button onClick={() => goTo('demo')}>Try a demo</button>
        </nav>
        <button className="top-cta" onClick={() => goTo('demo')}>Start learning <span>↗</span></button>
      </header>

      <main>
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow"><i /> A clearer way to learn programming</div>
            <h1>See the logic.<br /><span>Not just the code.</span></h1>
            <p className="hero-description">Meet your friendly AI programming companion. Understand code line by line, watch logic come alive, and make tricky topics feel simple.</p>
            <div className="hero-actions"><button className="primary-button" onClick={() => goTo('demo')}>Explore CodeLens <span>→</span></button><button className="secondary-button" onClick={() => goTo('features')}>Discover features <span>↓</span></button></div>
            <div className="hero-proof"><div className="avatar-stack"><span>👩🏻‍💻</span><span>🧑🏽‍🎓</span><span>👨🏼‍💻</span></div><div><strong>Learn at your own pace</strong><small>Built for curious minds and new coders</small></div></div>
          </div>
          <div className="hero-art">
            <div className="float-chip chip-top"><span>✦</span> Learn visually</div>
            <div className="code-window">
              <div className="window-top"><div className="window-dots"><i /><i /><i /></div><span className="file-label"><b>C++</b> sum.cpp</span><span className="window-status"><i /> Ready</span></div>
              <div className="code-content"><div className="code-lines">
                <div><em>01</em><span className="purple">int</span> <span className="white">a</span> = <span className="orange">10</span>;</div>
                <div><em>02</em><span className="purple">int</span> <span className="white">b</span> = <span className="orange">20</span>;</div>
                <div className="active-line"><em>03</em><span className="purple">int</span> <span className="white">sum</span> = a + b;</div>
                <div><em>04</em><span className="pink">cout</span> &lt;&lt; sum;</div>
              </div><div className="visual-label"><span>↓</span> MEMORY VIEW <span>↓</span></div>
              <div className="memory-cards"><div className="memory-card mem-a"><small>int a</small><strong>10</strong></div><div className="memory-card mem-b"><small>int b</small><strong>20</strong></div><div className="memory-card mem-sum"><small>int sum</small><strong>30</strong></div></div></div>
              <div className="window-bottom"><span><i /> Program explained</span><span>Step 03 / 04</span></div>
            </div>
            <div className="float-chip chip-bottom"><span>✦</span> From confusion to clarity</div><div className="spark spark-one">✳</div><div className="spark spark-two">✦</div>
          </div>
        </section>

        <section className="trust-strip section-wrap"><span>MADE FOR THE WAY YOU LEARN</span><div><b>01</b> Understand concepts</div><div><b>02</b> Visualize the steps</div><div><b>03</b> Practice with confidence</div></section>

        <section className="features-section section-wrap" id="features">
          <div className="section-heading"><div><div className="kicker">YOUR LEARNING TOOLKIT</div><h2>Big concepts. <span>Made simple.</span></h2></div><p>Everything you need to move from “I don't get it” to “Oh, now I see!”</p></div>
          <div className="feature-grid">{features.map((f) => <article className={`feature-card ${f.tone}`} key={f.n}><div className="feature-top"><span className="feature-icon">{f.icon}</span><span className="feature-number">{f.n}</span></div><h3>{f.title}</h3><p>{f.text}</p><span className="feature-arrow">↗</span></article>)}</div>
        </section>

        <section className="demo-section section-wrap" id="demo">
          <div className="demo-copy"><div className="kicker">A LITTLE PREVIEW</div><h2>Code goes in.<br /><span>Clarity comes out.</span></h2><p>Take a tiny C++ example for a spin. Move through the steps and see what each line does.</p><label htmlFor="language">Explanation language</label><select id="language" value={language} onChange={(e) => setLanguage(e.target.value as 'English' | 'Roman Urdu')}><option>English</option><option>Roman Urdu</option></select></div>
          <div className="demo-panel"><div className="demo-head"><span><i /> INTERACTIVE PREVIEW</span><b>C++</b></div><div className="demo-code">{demoSteps.map((s, i) => <button className={i === step ? 'demo-line selected' : 'demo-line'} key={s.code} onClick={() => setStep(i)}><span>{String(i + 1).padStart(2, '0')}</span><code>{s.code}</code>{i === step && <b>●</b>}</button>)}</div><div className="explanation"><div className="explanation-title">✦ CODELENS EXPLAINS</div><p>{language === 'English' ? demoSteps[step].note : demoSteps[step].roman}</p><div className="step-controls"><span>Step {step + 1} of {demoSteps.length}</span><button onClick={() => setStep((step + 1) % demoSteps.length)}>Next step <b>→</b></button></div></div></div>
        </section>

        <section className="how-section section-wrap" id="how"><div className="center-heading"><div className="kicker">YOUR NEXT STEP STARTS HERE</div><h2>Learn in <span>three simple steps.</span></h2></div><div className="how-grid"><article className="how-card"><div className="how-icon one">⌨️</div><span>STEP 01</span><h3>Bring your code</h3><p>Write a snippet or choose a beginner-friendly example.</p></article><article className="how-card"><div className="how-icon two">✨</div><span>STEP 02</span><h3>Let it make sense</h3><p>Explore a clear explanation and follow the logic visually.</p></article><article className="how-card"><div className="how-icon three">🚀</div><span>STEP 03</span><h3>Practice and grow</h3><p>Try a new example, ask questions and build confidence.</p></article></div></section>

        <section className="final-cta section-wrap"><div><div className="kicker">READY WHEN YOU ARE</div><h2>Make code click.</h2><p>Your programming journey deserves a clearer view.</p></div><button className="primary-button" onClick={() => goTo('demo')}>Try the interactive demo <span>→</span></button><div className="cta-spark">✳</div></section>
      </main>
      <footer className="footer section-wrap"><a className="brand" href="#home"><span className="brand-mark"><span /></span><span className="brand-name">CodeLens<span>AI</span></span></a><p>Understand code. Visualize logic. Keep growing.</p><small>© 2026 CodeLens AI · Learning, made clearer.</small></footer>
    </div>
  )
}

export default App
