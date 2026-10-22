/* ── North Star — a page shown inside a dot hides its own header ──
 * Susanna, 10:14 am 10/22 (screenshot of AURORA on susannashu.com/north-star): "remove the double title on top
 * and in the segment, only keep one". The dot view (view.js) already shows breadcrumb + big title + one line +
 * status, so a page embedded under it (iframe src carries ?embed=1) hides its own breadcrumb, h1, lead line and
 * status chips. Opening the page on its own ("open full") is untouched.
 *
 * window.nsEmbedHead(doc) -> { lead, hidden } -- works on ~300 hand-made pages without editing them:
 * the first h1 (when no h2 comes before it), the breadcrumb/eyebrow lines just above it, and the lead / meta /
 * status / chip lines just after it (by class); a header box left empty is hidden too. Links, buttons, diagrams
 * and unclassed paragraphs stay. `lead` = the hidden description text, so the shell can keep the richer line.
 * Called by view.js on iframe load (same origin), and by the page itself through tips.js when the page is
 * cross-origin (cloud) -- then it posts {ns:'embed-head', lead} to the parent. Idempotent.
 */
(function(){
const CRUMB = /^(eyebrow|kick|kicker|crumb|crumbs|breadcrumb|breadcrumbs|lbl|over|overline|path|trail)$/;
const LEAD = /^(lede|lead|sub|subtitle|dek|tagline|intro|standfirst|summary)$/;
const META = /^(meta|byline|asof|stamp|state|status|st|chip|chips|pill|pills|due|draft|cap|s|tags|badge|badges|when|date|updated)$/;
const HEAVY = 'img,video,iframe,table,canvas,button,input,select,textarea,figure,pre,ul,ol';
const cls = el => [...(el.classList || [])].map(c => c.toLowerCase());
const has = (el, re) => cls(el).some(c => re.test(c));
const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
const plain = (el, max) => !el.querySelector(HEAVY) && ![...el.querySelectorAll('svg')].some(s => (s.getAttribute('width') | 0) > 24 || s.getAttribute('viewBox') && !s.getAttribute('width')) && txt(el).length <= max;
const skip = el => el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEMPLATE' || el.tagName === 'svg' || el.tagName === 'SVG' || el.tagName === 'LINK';
const hide = (el, out) => { el.style.setProperty('display', 'none', 'important'); el.setAttribute('data-ns-embed-hidden', ''); out.push(el); };

window.nsEmbedHead = function(doc){
  doc = doc || document;
  const root = doc.documentElement;
  if (!root || !doc.body) return null;
  if (root.hasAttribute('data-ns-embed')) return { lead: root.getAttribute('data-ns-embed-lead') || '', hidden: [] };
  const h1 = doc.body.querySelector('h1');
  if (!h1) return null;
  const h2 = doc.body.querySelector('h2,h3');
  if (h2 && (h2.compareDocumentPosition(h1) & 4)) return null;      // a heading comes before the h1: not a page header
  const hidden = []; let lead = '';
  const small = h1.querySelector('small');
  // before the h1: breadcrumb / eyebrow lines
  for (let el = h1.previousElementSibling; el; el = el.previousElementSibling) {
    if (skip(el)) continue;
    if ((has(el, CRUMB) || has(el, META) || el.tagName === 'NAV') && plain(el, 220)) hide(el, hidden); else break;
  }
  hide(h1, hidden);
  // after the h1: the lead line, then meta / status / chip lines (in any order), until real content starts
  for (let el = h1.nextElementSibling; el; el = el.nextElementSibling) {
    if (skip(el)) continue;
    if (has(el, LEAD) && plain(el, 900)) { if (!lead) lead = txt(el); hide(el, hidden); continue; }
    if (has(el, META) && plain(el, 300)) { hide(el, hidden); continue; }
    if (el.tagName === 'SPAN' && plain(el, 120)) { hide(el, hidden); continue; }    // a bare status chip
    if (/^(DIV|P)$/.test(el.tagName) && el.children.length && [...el.children].every(c => has(c, META) || c.tagName === 'SPAN') && plain(el, 300)) { hide(el, hidden); continue; }   // a row of chips
    break;
  }
  if (!lead && small) lead = txt(small);
  // a header box (header.top, .hdr ...) left with nothing visible: hide it too, so its padding/border goes
  const box = h1.parentElement;
  if (box && box !== doc.body && !/^(MAIN|ARTICLE)$/.test(box.tagName) && !has(box, /^(wrap|container|page|main|content)$/)
      && [...box.children].every(c => c.hasAttribute('data-ns-embed-hidden') || skip(c))) hide(box, hidden);
  root.setAttribute('data-ns-embed', '');
  root.setAttribute('data-ns-embed-lead', lead);
  return { lead, hidden };
};

// inside the page itself (tips.js loads this file when ?embed=1): run, and tell the dot view the lead line
if (/[?&]embed=1(&|$)/.test(location.search) && window.parent !== window) {
  const run = () => { const r = window.nsEmbedHead(document); if (r) try { window.parent.postMessage({ ns: 'embed-head', lead: r.lead, href: location.pathname }, '*'); } catch {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
}
})();
