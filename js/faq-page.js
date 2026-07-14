// Standalone FAQ page bootstrap.
import './nav.js';
import { renderFAQ } from './faq.js';

const faqBody = document.getElementById('faq-body');
if (faqBody && faqBody.children.length === 0) renderFAQ(faqBody);

if (location.hash) {
  const target = document.getElementById(location.hash.slice(1));
  if (target && target.classList.contains('faq-item')) {
    target.open = true;
    requestAnimationFrame(() => target.scrollIntoView());
  }
}
