/* =====================================================================
   Calculators — the four property calculators, on the site itself.

   The arithmetic is not implemented here: it comes from tariffs.js, the same
   verified engine the HSG Property app uses, and the rates come from
   /tariffs.json, so editing that one file on the host updates both.

   Module script: without JavaScript the page still shows its explanation,
   the disclaimer and a route to a formal quote.
   ===================================================================== */
import {
  loadRemoteRates, transferCostBreakdown, bondCostBreakdown, bondRepayment, affordability,
} from './tariffs.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const money = n => 'R ' + Math.round(Number(n) || 0).toLocaleString('en-ZA');
const num = el => Number(String(el.value).replace(/[^\d.]/g, '')) || 0;
const groups = v => (String(v).replace(/\D/g, '') || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ---- currency fields: grouped digits while typing, caret kept in place ---- */
function bindMoney(input) {
  const format = () => {
    const before = input.value, caretFromEnd = before.length - (input.selectionStart ?? before.length);
    const digits = before.replace(/\D/g, '');
    input.value = digits ? groups(digits) : '';
    const pos = Math.max(0, input.value.length - caretFromEnd);
    try { input.setSelectionRange(pos, pos); } catch { /* not a text input */ }
  };
  input.addEventListener('input', format);
  format();
}

/* ---- rendering ---- */
const row = (label, note, amount) =>
  `<tr><th scope="row">${label}${note ? `<span>${note}</span>` : ''}</th><td>${money(amount)}</td></tr>`;

function renderResult(panel, { headline, headlineValue, secondary, secondaryValue, rows, caption }) {
  $('.calc-headline-label', panel).textContent = headline;
  $('.calc-headline-value', panel).textContent = headlineValue;
  $('.calc-secondary', panel).innerHTML = secondary ? `${secondary} <strong>${secondaryValue}</strong>` : '';
  const table = $('.calc-table', panel);
  table.innerHTML = rows ? `<caption>${caption || ''}</caption><tbody>${rows}</tbody>` : '';
  table.hidden = !rows;
}

/* ---- the four calculators ---- */
const COMPUTE = {
  transfer(get) {
    const price = get('price');
    const b = transferCostBreakdown(price);
    return {
      headlineValue: money(b.total),
      secondaryValue: money(b.grandTotal),
      rows: b.items.map(i => row(i.label, i.note, i.amount)).join(''),
      caption: `Costs on a purchase price of ${money(price)}`,
      scenario: `Transfer costs on a purchase price of ${money(price)}: estimated costs ${money(b.total)}, total ${money(b.grandTotal)}.`,
    };
  },
  bond(get) {
    const loan = get('loan');
    const b = bondCostBreakdown(loan);
    return {
      headlineValue: money(b.total),
      secondaryValue: money(b.totalWithLoan),
      rows: b.items.map(i => row(i.label, i.note, i.amount)).join(''),
      caption: `Costs on a bond of ${money(loan)}`,
      scenario: `Bond registration costs on a bond of ${money(loan)}: estimated costs ${money(b.total)}.`,
    };
  },
  repayment(get) {
    const loan = get('loan'), rate = get('rate'), years = get('years');
    const b = bondRepayment(loan, rate, years);
    return {
      headlineValue: money(b.monthly),
      secondaryValue: money(b.totalRepay),
      rows: [
        row('Bond amount', '', loan),
        row('Monthly instalment', `${rate}% over ${years} years`, b.monthly),
        row('Total interest', 'Over the full term', b.totalInterest),
        row('Total repaid', 'Capital and interest', b.totalRepay),
      ].join(''),
      caption: `A bond of ${money(loan)} at ${rate}% over ${years} years`,
      scenario: `Bond repayment on ${money(loan)} at ${rate}% over ${years} years: ${money(b.monthly)} a month.`,
    };
  },
  affordability(get) {
    const grossIncome = get('income'), expenses = get('expenses'), deposit = get('deposit');
    const rate = get('rate'), years = get('years');
    const b = affordability({ grossIncome, expenses, annualRatePct: rate, years, deposit });
    return {
      headlineValue: money(b.indicativePrice),
      secondaryValue: money(b.maxLoan),
      rows: [
        row('Affordable instalment', 'The lower of 30% of income and your disposable income', b.affordableInstalment),
        row('Maximum bond', `${rate}% over ${years} years`, b.maxLoan),
        row('Deposit', '', deposit),
        row('Indicative purchase price', 'Bond plus deposit', b.indicativePrice),
      ].join(''),
      caption: `On ${money(grossIncome)} a month with ${money(expenses)} of expenses`,
      scenario: `Affordability on ${money(grossIncome)} a month: indicative price ${money(b.indicativePrice)}, maximum bond ${money(b.maxLoan)}.`,
    };
  },
};

/* ---- wiring ---- */
function init() {
  const root = $('.calculators');
  if (!root) return;
  const panels = $$('.calc-panel', root);
  const tabs = $$('.calc-tab', root);

  const run = panel => {
    const id = panel.dataset.calc;
    const get = name => num($(`[name="${name}"]`, panel));
    const quote = $('.calc-quote', panel);
    // Nothing is shown until every figure the calculation needs has been entered.
    const waiting = $$('input[data-required]', panel).some(i => !i.value.trim() || num(i) <= 0);
    if (waiting) {
      renderResult(panel, { headline: panel.dataset.headline, headlineValue: '—', secondary: '', rows: '' });
      if (quote) quote.href = '/contact/#enquire';
      return;
    }
    const result = COMPUTE[id](get);
    renderResult(panel, {
      headline: panel.dataset.headline, secondary: panel.dataset.secondary, ...result,
    });
    if (quote) quote.href = '/contact/?enquiry=' + encodeURIComponent(result.scenario) + '#enquire';
  };

  for (const panel of panels) {
    $$('input', panel).forEach(input => {
      if (input.dataset.kind === 'money') bindMoney(input);
      input.addEventListener('input', () => run(panel));
    });
    run(panel);
  }

  const select = i => {
    tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; });
    panels.forEach((p, j) => { p.hidden = i !== j; });
    history.replaceState(null, '', i ? `#${panels[i].dataset.calc}` : location.pathname);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', e => {
      const n = tabs.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); select((i + 1) % n); tabs[(i + 1) % n].focus(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); select((i - 1 + n) % n); tabs[(i - 1 + n) % n].focus(); }
    });
  });
  const fromHash = panels.findIndex(p => p.dataset.calc === location.hash.slice(1));
  select(fromHash > 0 ? fromHash : 0);

  // Rates come from the host's tariffs.json when it is reachable; the verified
  // defaults baked into tariffs.js stand in if it is not.
  loadRemoteRates('/tariffs.json').then(() => panels.forEach(run)).catch(() => {});
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
