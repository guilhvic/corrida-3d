// Idioma da interface: português (texto original do código) ou inglês (dicionário em lang-en.js).
// t('texto em português', { chave }) devolve a tradução com {chave} preenchida. O HTML estático é traduzido por
// translateDom, que guarda o texto original de cada nó para poder voltar ao português.
// Os textos do mapa (placas, neon, faixas) e o narrador continuam em japonês nos dois idiomas.
import { EN } from './lang-en.js';

export const LANGUAGES = ['pt', 'en'];
let lang = 'pt';
const listeners = new Set();

export const getLang = () => lang;
export const locale = () => (lang === 'en' ? 'en-US' : 'pt-BR');

// Idioma inicial: o salvo nas configurações ou o do navegador
export function defaultLang() {
  const nav = (globalThis.navigator?.language || 'pt').toLowerCase();
  return nav.startsWith('pt') ? 'pt' : 'en';
}

export function t(text, params) {
  let out = lang === 'en' ? (EN[text] ?? text) : text;
  if (params) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
  return out;
}

export function setLang(next) {
  const value = LANGUAGES.includes(next) ? next : 'pt';
  if (value === lang) return;
  lang = value;
  if (globalThis.document) {
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
    translateDom(document.body);
  }
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// --- HTML estático ------------------------------------------------------------------------------------------
// Texto original (português) de cada nó e atributo já visto
const originalText = new WeakMap();
const originalAttr = new WeakMap();
const ATTRS = ['aria-label', 'title', 'placeholder'];

// Traduz nós de texto e atributos por texto exato (espaços das pontas preservados). Elementos com
// data-i18n-skip (conteúdo gerado pelo JavaScript) ficam de fora.
export function translateDom(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (node.nodeType === 1) {
        const el = /** @type {Element} */ (node);
        if (el.hasAttribute('data-i18n-skip') || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!originalText.has(node)) {
      if (!node.nodeValue.trim()) continue;
      originalText.set(node, node.nodeValue);
    }
    const src = originalText.get(node);
    const core = src.trim();
    const lead = src.slice(0, src.indexOf(core)), tail = src.slice(src.indexOf(core) + core.length);
    node.nodeValue = lead + t(core) + tail;
  }
  for (const el of root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(','))) {
    if (el.closest('[data-i18n-skip]')) continue;
    let saved = originalAttr.get(el);
    if (!saved) { saved = {}; originalAttr.set(el, saved); }
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      if (!(a in saved)) saved[a] = el.getAttribute(a);
      el.setAttribute(a, t(saved[a]));
    }
  }
}
