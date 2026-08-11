/**
 * Analytics consent banner.
 *
 * Google Consent Mode v2 defaults to denied in each page's head, before the
 * gtag config call, so no analytics cookie is written until someone accepts.
 * This file only draws the banner and flips the signal; the default lives
 * inline because it has to run before the tag does.
 *
 * Cloudflare Web Analytics is deliberately not gated. It sets no cookie and
 * assigns no identifier, so it needs no consent and keeps working either way.
 *
 * The choice is kept in localStorage rather than a cookie — storing consent
 * in the thing being consented to is a circular problem.
 */
(function () {
  'use strict';

  var KEY = 'cw-consent';
  var stored = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch (e) {
    /* Safari private mode and similar. Fall through and ask again. */
  }
  if (stored === 'granted' || stored === 'denied') return;

  function remember(value) {
    try {
      localStorage.setItem(KEY, value);
    } catch (e) {
      /* If we cannot persist it, honour it for this page view at least. */
    }
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var css = document.createElement('style');
    css.textContent = [
      '.cw-consent{position:fixed;left:0;right:0;bottom:0;z-index:2000;',
      'background:oklch(0.97 0.012 85);border-top:1px solid oklch(0.86 0.018 80);',
      'box-shadow:0 -8px 32px oklch(0.32 0.08 263/0.07);',
      'font-family:"Geist",ui-sans-serif,system-ui,sans-serif;color:oklch(0.46 0.045 263);',
      'transform:translateY(100%);transition:transform .5s cubic-bezier(0.16,1,0.3,1)}',
      '.cw-consent[data-in]{transform:translateY(0)}',
      '.cw-consent-in{max-width:72rem;margin:0 auto;padding:1.1rem max(1.25rem,6vw);',
      'display:flex;align-items:center;justify-content:space-between;gap:1.5rem;flex-wrap:wrap}',
      '.cw-consent p{margin:0;font-size:.875rem;line-height:1.6;max-width:62ch}',
      '.cw-consent a{color:oklch(0.32 0.08 263);text-decoration:underline;text-underline-offset:3px}',
      '.cw-consent a:hover{color:oklch(0.66 0.14 50)}',
      '.cw-consent-actions{display:flex;align-items:center;gap:.85rem;flex-shrink:0}',
      '.cw-consent button{font:inherit;cursor:pointer}',
      '.cw-ok{background:oklch(0.32 0.08 263);color:oklch(0.97 0.012 85);border:0;',
      'border-radius:.5rem;padding:.7rem 1.15rem;font-size:.875rem;font-weight:500;',
      'transition:background-color .2s}',
      '.cw-ok:hover{background:oklch(0.66 0.14 50)}',
      '.cw-no{background:none;border:0;padding:.7rem .25rem;font-size:.8125rem;',
      'color:oklch(0.62 0.025 263);text-decoration:underline;text-underline-offset:3px}',
      '.cw-no:hover{color:oklch(0.32 0.08 263)}',
      '.cw-consent :focus-visible{outline:2px solid oklch(0.66 0.14 50);outline-offset:3px;border-radius:2px}',
      '@media (max-width:640px){.cw-consent-in{gap:1rem}.cw-consent-actions{width:100%;',
      'justify-content:space-between}}',
      '@media (prefers-reduced-motion:reduce){.cw-consent{transition:none}}',
    ].join('');
    document.head.appendChild(css);

    var bar = document.createElement('div');
    bar.className = 'cw-consent';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Analytics consent');
    bar.innerHTML =
      '<div class="cw-consent-in">' +
      '<p>We would like to measure how this site is used, with Google Analytics. ' +
      'It sets a cookie. We run no advertising and build no profile of you, and ' +
      'declining changes nothing about how the site works. ' +
      '<a href="/privacy">Read the Privacy Policy</a>.</p>' +
      '<div class="cw-consent-actions">' +
      '<button type="button" class="cw-no">Decline</button>' +
      '<button type="button" class="cw-ok">I am OK with all this</button>' +
      '</div></div>';
    document.body.appendChild(bar);

    // Next frame, so the transform transition actually runs.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        bar.setAttribute('data-in', '');
      });
    });

    function dismiss() {
      bar.removeAttribute('data-in');
      setTimeout(function () {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }, 500);
    }

    bar.querySelector('.cw-ok').addEventListener('click', function () {
      remember('granted');
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', { analytics_storage: 'granted' });
      }
      dismiss();
    });

    bar.querySelector('.cw-no').addEventListener('click', function () {
      remember('denied');
      dismiss();
    });
  });
})();
