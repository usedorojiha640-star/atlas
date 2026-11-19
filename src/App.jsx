import React, { useMemo, useState, useEffect } from 'react';

const TELEGRAM_URL = 'https://t.me/cashers_manager_1'; // Replace with your actual manager URL if needed
const FIAT = ['USD', 'EUR', 'RUB', 'CNY', 'KZT'];
const CRYPTO = ['USDT', 'BTC', 'ETH'];
const SYMBOLS = { USD:'$', EUR:'€', RUB:'₽', CNY:'¥', KZT:'₸', USDT:'₮', BTC:'₿', ETH:'Ξ' };
const LABELS = { USD:'Доллар США', EUR:'Евро', RUB:'Рубль', CNY:'Юань', KZT:'Тенге', USDT:'Tether', BTC:'Bitcoin', ETH:'Ethereum' };
// Approximate demonstration rates: units of each currency per one USD.
const FALLBACK = { USD:1, EUR:.92, RUB:92.5, CNY:7.25, KZT:470, USDT:1, BTC:1/95000, ETH:1/3500 };
const FAQS = [
  { q:'Как происходит обмен?', a:'Вы выбираете направление и сумму, отправляете заявку в Telegram, а менеджер сообщает условия, подтверждает курс и согласует дальнейшие шаги.' },
  { q:'Можно ли зафиксировать курс?', a:'Возможность фиксации курса и срок его действия необходимо согласовать с менеджером до проведения операции.' },
  { q:'Где проходит обмен?', a:'Доступность конкретного города, офиса или встречи уточняется у менеджера. Адрес не публикуется без предварительного согласования.' },
  { q:'Курс в калькуляторе окончательный?', a:'Нет. Это предварительный расчёт по справочным данным. Итоговый курс, комиссии и доступность направления подтверждаются в заявке.' },
];

function Arrow({ diagonal=false }) { return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={diagonal ? 'M5 19 19 5M8 5h11v11' : 'M4 12h16m-7-7 7 7-7 7'} /></svg>; }
function Swap() { return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16l-4-4m4 4-4 4M20 17H4l4 4m-4-4 4-4"/></svg>; }
function Brand() { return <span className="brand-icon" aria-hidden="true"><i/><i/><i/></span>; }
function CurrencyField({ caption, value, onAmountChange, code, onCodeChange, options, readOnly=false }) {
  return <div className="money-field">
    <div className="money-top"><span>{caption}</span><span className="money-side">{readOnly?'Предварительно':'Сумма обмена'}</span></div>
    <div className="money-bottom">
      <input aria-label={caption} type="number" min="0" step="any" inputMode="decimal" value={value} readOnly={readOnly} onChange={e=>onAmountChange?.(e.target.value)} />
      <div className="currency-group"><span className="currency-symbol">{SYMBOLS[code]}</span><select aria-label={`Валюта: ${caption}`} value={code} onChange={e=>onCodeChange(e.target.value)}>{options.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
    </div>
  </div>;
}

export default function App() {
  const [mode, setMode] = useState('sell');
  const [crypto, setCrypto] = useState('USDT');
  const [fiat, setFiat] = useState('EUR');
  const [amount, setAmount] = useState('1000');
  const [city, setCity] = useState('');
  const [rates, setRates] = useState(FALLBACK);
  const [ratesSource, setRatesSource] = useState('demo');
  const [expanded, setExpanded] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    let active=true;
    async function loadRates() {
      try {
        const [fxResponse, cryptoResponse] = await Promise.all([
          fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'),
          fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether,bitcoin,ethereum&vs_currencies=usd')
        ]);
        if (!fxResponse.ok || !cryptoResponse.ok) throw new Error('rates unavailable');
        const fx=(await fxResponse.json()).usd;
        const coins=await cryptoResponse.json();
        const next={
          USD:1, EUR:fx.eur, RUB:fx.rub, CNY:fx.cny, KZT:fx.kzt,
          USDT: 1/coins.tether.usd, BTC:1/coins.bitcoin.usd, ETH:1/coins.ethereum.usd
        };
        if (Object.values(next).some(v=>!Number.isFinite(v)||v<=0)) throw new Error('invalid rates');
        if (active) {setRates(next);setRatesSource('reference');}
      } catch { if(active) setRatesSource('demo'); }
    }
    loadRates();
    return ()=>{ active=false; };
  }, []);

  const numericAmount = Number(amount);
  const valid = amount.trim()!=='' && Number.isFinite(numericAmount) && numericAmount>0;
  // Approximate quote only. No automatic claim of a live, fixed, or guaranteed rate.
  const rawRate = mode==='sell' ? rates[fiat]/rates[crypto] : rates[crypto]/rates[fiat];
  const spread = mode==='sell' ? 1.025 : .97;
  const effectiveRate = rawRate*spread;
  const result = valid ? numericAmount*effectiveRate : 0;
  const formatValue = n => n.toLocaleString('ru-RU', {maximumFractionDigits: n < 1 ? 8 : 2, minimumFractionDigits:2});
  const fromCode=mode==='sell'?crypto:fiat;
  const toCode=mode==='sell'?fiat:crypto;
  const telegramLink=useMemo(()=>{
    const text=[
      'Здравствуйте! Хочу согласовать обмен в BURO PAY.',
      `Направление: ${mode==='sell'?'криптовалюта → наличные':'наличные → криптовалюта'}.`,
      `Отдаю: ${valid?amount:'—'} ${fromCode}.`,
      `Получаю (ориентировочно): ${valid?formatValue(result):'—'} ${toCode}.`,
      `Город: ${city.trim() || 'уточню с менеджером'}.`,
      'Прошу подтвердить актуальный курс, комиссии и условия.'
    ].join('\n');
    return `${TELEGRAM_URL}?text=${encodeURIComponent(text)}`;
  },[mode, amount, crypto, fiat, city, result, valid, fromCode, toCode]);
  const changeMode = () => {setMode(prev=>prev==='sell'?'buy':'sell');setAmount('1000');};

  return <div className="site">
    <div className="utility-bar"><div className="shell utility-inner"><span><span className="utility-dot"/> Заявки на обмен — 24/7</span><span className="utility-right">Согласование условий напрямую с менеджером <span className="utility-divider">/</span> BURO PAY</span></div></div>
    <header className="header shell">
      <a href="#top" className="brand" aria-label="BURO PAY — главная"><Brand/><span>BURO<span className="brand-light">PAY</span><small>EXCHANGE SERVICE</small></span></a>
      <nav className={mobileMenu?'nav nav-open':'nav'} aria-label="Основная навигация">
        <a href="#exchange" onClick={()=>setMobileMenu(false)}>Обменять</a><a href="#approach" onClick={()=>setMobileMenu(false)}>Преимущества</a><a href="#steps" onClick={()=>setMobileMenu(false)}>Как это работает</a><a href="#questions" onClick={()=>setMobileMenu(false)}>Вопросы</a>
      </nav>
      <a className="header-contact" href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">Связаться <Arrow diagonal/></a>
      <button className="menu-toggle" aria-label="Открыть или закрыть меню" aria-expanded={mobileMenu} onClick={()=>setMobileMenu(!mobileMenu)}>{mobileMenu?'Закрыть':'Меню'} <span>{mobileMenu?'×':'+'}</span></button>
    </header>

    <main id="top">
      <section className="intro shell">
        <div className="intro-kicker"><span className="small-line"/> ОБМЕН КРИПТОВАЛЮТЫ И НАЛИЧНЫХ <span className="intro-number">01 / 04</span></div>
        <h1>Цифровые активы.<br/><span>Реальные деньги.</span></h1>
        <div className="intro-end"><p>Простой способ согласовать обмен криптовалюты на наличные и обратно. Без лишних форм и непонятных условий.</p><a href="#exchange" className="round-arrow" aria-label="Перейти к калькулятору"><Arrow/></a></div>
      </section>

      <section id="exchange" className="exchange-zone">
        <div className="shell">
          <div className="zone-heading"><div><span className="eyebrow">01 — РАСЧЁТ</span><h2>Начните с суммы.</h2></div><p>Выберите направление обмена — и получите ориентировочный расчёт за несколько секунд.</p></div>
          <div className="ticket">
            <div className="ticket-head"><div className="ticket-code">BP / EXCHANGE <span>№ 001</span></div><div className="tabs" role="group" aria-label="Направление обмена"><button className={mode==='sell'?'active':''} aria-pressed={mode==='sell'} onClick={()=>setMode('sell')}>Продать криптовалюту</button><button className={mode==='buy'?'active':''} aria-pressed={mode==='buy'} onClick={()=>setMode('buy')}>Купить криптовалюту</button></div></div>
            <div className="ticket-main">
              <CurrencyField caption="01 / Вы отдаёте" value={amount} onAmountChange={setAmount} code={fromCode} onCodeChange={mode==='sell'?setCrypto:setFiat} options={mode==='sell'?CRYPTO:FIAT} />
              <button type="button" className="swap-btn" onClick={changeMode} aria-label="Поменять направление обмена"><Swap/></button>
              <CurrencyField caption="02 / Вы получаете" value={valid?result.toFixed(toCode==='BTC'||toCode==='ETH'?8:2):'0.00'} code={toCode} onCodeChange={mode==='sell'?setFiat:setCrypto} options={mode==='sell'?FIAT:CRYPTO} readOnly />
            </div>
            <div className="ticket-bottom">
              <div className="rate-line"><span>Ориентировочный курс</span><strong>1 {fromCode} ≈ {formatValue(effectiveRate)} {toCode}</strong><small>{ratesSource==='reference'?'Справочные рыночные данные':'Демонстрационные данные'}</small></div>
              <div className="city-line"><label htmlFor="city">Город обмена <span>(по желанию)</span></label><input id="city" value={city} onChange={e=>setCity(e.target.value)} placeholder="Укажите город" maxLength={80}/></div>
              <a href={valid?telegramLink:undefined} className={`submit-btn ${valid?'':'disabled'}`} aria-disabled={!valid} onClick={e=>{if(!valid)e.preventDefault()}} target="_blank" rel="noopener noreferrer"><span>Согласовать обмен</span><Arrow diagonal/></a>
            </div>
          </div>
          <div className="ticket-note"><span>✳</span> Расчёт справочный, не является офертой. Финальный курс, комиссии и место встречи подтверждает менеджер.</div>
        </div>
      </section>

      <section className="manifesto" id="approach"><div className="shell manifesto-grid"><div className="manifesto-head"><span className="eyebrow">02 — ПОДХОД</span><h2>Меньше шума.<br/><em>Больше ясности.</em></h2></div><div className="manifesto-right"><p className="manifesto-lead">Мы убрали всё лишнее между вами и заявкой на обмен.</p><div className="manifesto-item"><span>01</span><div><h3>Понятный расчёт</h3><p>Сумма и направление видны сразу. Перед сделкой менеджер подтверждает условия.</p></div></div><div className="manifesto-item"><span>02</span><div><h3>Прямой контакт</h3><p>Без длинной регистрации — детали можно обсудить в Telegram.</p></div></div><div className="manifesto-item"><span>03</span><div><h3>Персональное согласование</h3><p>Город, формат и время обмена уточняются индивидуально.</p></div></div></div></div></section>

      <section className="steps shell" id="steps"><div className="section-caption"><span className="eyebrow">03 — ПРОЦЕСС</span><span>ПРОСТОЙ ПУТЬ К ОБМЕНУ</span></div><h2>Четыре действия.<br/>Никакой сложности.</h2><div className="steps-list"><div><b>01</b><h3>Выберите направление</h3><p>Укажите, что отдаёте и что хотите получить.</p></div><div><b>02</b><h3>Получите расчёт</h3><p>Калькулятор покажет примерную сумму.</p></div><div><b>03</b><h3>Свяжитесь с нами</h3><p>Передайте заявку менеджеру одним нажатием.</p></div><div><b>04</b><h3>Согласуйте условия</h3><p>Подтвердите курс, город и формат обмена до сделки.</p></div></div></section>

      <section className="questions" id="questions"><div className="shell questions-inner"><div className="questions-title"><span className="eyebrow">04 — ОТВЕТЫ</span><h2>Частые<br/>вопросы<span className="orange-dot">.</span></h2><p>Не нашли ответ? Напишите менеджеру.</p><a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-link">Открыть Telegram <Arrow diagonal/></a></div><div className="faq-list">{FAQS.map((f,i)=><div className="faq" key={f.q}><button aria-expanded={expanded===i} onClick={()=>setExpanded(expanded===i?-1:i)}><span>{String(i+1).padStart(2,'0')}</span><strong>{f.q}</strong><b>{expanded===i?'−':'+'}</b></button>{expanded===i && <p>{f.a}</p>}</div>)}</div></div></section>

      <section className="closing shell"><span className="eyebrow">БУДЕМ НА СВЯЗИ</span><div className="closing-main"><h2>Обмен начинается<br/>с разговора.</h2><a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="closing-circle" aria-label="Написать в Telegram"><Arrow diagonal/></a></div><div className="closing-line"><span>BURO PAY / PRIVATE EXCHANGE</span><span>Пишите — обсудим детали</span></div></section>
    </main>
    <footer className="footer"><div className="shell footer-inside"><div className="footer-brand"><Brand/> BURO PAY</div><span>© {new Date().getFullYear()} BURO PAY</span><span>Информация не является публичной офертой</span><a href="#top">Наверх ↑</a></div></footer>
  </div>;
}
