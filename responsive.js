(function () {
  'use strict';

  const SCROLL_SHELL_SELECTOR = [
    '.responsive-table-scroll',
    '.overflow-x-auto',
    '.overflow-auto',
    '.table-shell',
    '.pbd-premium-scroll',
    '.hc-student-scroll'
  ].join(',');

  const semanticColumnRules = [
    { pattern: /^(nama murid|murid|nama)$/i, className: 'responsive-name-column' },
    { pattern: /(kelas|guru sejarah|guru mata pelajaran|pengguna)/i, className: 'responsive-left-column' },
    { pattern: /(standard pembelajaran|standard kandungan|kandungan|tema|catatan|butiran|isu|strategi|hasil)/i, className: 'responsive-description-column' }
  ];

  function directColumnCount(table) {
    const row = table.tHead?.rows?.[table.tHead.rows.length - 1] || table.rows?.[0];
    if (!row) return 1;
    return Array.from(row.cells).reduce((total, cell) => total + Number(cell.colSpan || 1), 0);
  }

  function tableMinimumWidth(table) {
    if (table.id === 'pbd-matrix-table') return 1480;
    if (table.id === 'marks-spreadsheet') return 980;
    if (table.classList.contains('hc-student-table')) return 1525;
    if (table.id === 'pbd-an-heatmap-table' || table.closest('#pbd-an-heatmap-wrap')) return 1180;
    const columns = directColumnCount(table);
    if (columns <= 4) return 600;
    if (columns <= 6) return 860;
    if (columns <= 8) return 1120;
    return Math.min(1900, columns * 132);
  }

  function getOrCreateScrollShell(table) {
    const current = table.closest(SCROLL_SHELL_SELECTOR);
    if (current && current !== document.body && current !== document.documentElement) {
      current.classList.add('responsive-table-scroll');
      current.style.setProperty('overflow-x', 'auto', 'important');
      current.style.setProperty('max-width', '100%', 'important');
      current.style.setProperty('min-width', '0', 'important');
      current.style.setProperty('touch-action', 'pan-x pan-y', 'important');
      current.style.setProperty('-webkit-overflow-scrolling', 'touch');
      return current;
    }

    const shell = document.createElement('div');
    shell.className = 'responsive-table-scroll';
    table.parentNode.insertBefore(shell, table);
    shell.appendChild(table);
    shell.style.setProperty('overflow-x', 'auto', 'important');
    shell.style.setProperty('max-width', '100%', 'important');
    shell.style.setProperty('min-width', '0', 'important');
    shell.style.setProperty('touch-action', 'pan-x pan-y', 'important');
    shell.style.setProperty('-webkit-overflow-scrolling', 'touch');
    return shell;
  }

  function decorateColumns(table) {
    const headerRow = table.tHead?.rows?.[table.tHead.rows.length - 1];
    if (!headerRow) return;

    Array.from(headerRow.cells).forEach((header, index) => {
      const label = (header.textContent || '').replace(/\s+/g, ' ').trim();
      /* Mobile card layouts use the real column heading as the visible field
         label.  This keeps dynamically-rendered tables readable without
         duplicating application data or form controls. */
      Array.from(table.tBodies || []).forEach(body => {
        Array.from(body.rows).forEach(row => {
          const cell = row.cells[index];
          if (cell && Number(cell.colSpan || 1) === 1) cell.dataset.label = label || 'Maklumat';
        });
      });
      const rule = semanticColumnRules.find(item => item.pattern.test(label));
      if (!rule) return;
      header.classList.add(rule.className);
      Array.from(table.tBodies || []).forEach(body => {
        Array.from(body.rows).forEach(row => row.cells[index]?.classList.add(rule.className));
      });
    });
  }

  function enhanceTable(table) {
    if (!(table instanceof HTMLTableElement)) return;
    /* Report sheets are already composed to the exact A4 preview width.  Do not
       give them an interactive minimum width or scroll shell: the same sheets
       are captured for preview, PDF and print. */
    if (table.closest('#report-print-area')) {
      table.classList.remove('responsive-smart-table');
      table.style.removeProperty('--responsive-table-min');
      return;
    }
    table.classList.add('responsive-smart-table');
    if (table.id === 'marks-spreadsheet' || table.querySelector('#student-table-body')) {
      table.classList.add('responsive-entry-card-table');
    }
    if (table.closest('#completeness-content, #attention-content')) {
      table.classList.add('responsive-summary-card-table');
    }
    const minimumWidth = tableMinimumWidth(table);
    const usesPhoneCardLayout = window.innerWidth < 640 && (
      table.classList.contains('responsive-entry-card-table') ||
      table.classList.contains('responsive-summary-card-table')
    );
    table.style.setProperty('--responsive-table-min', `${minimumWidth}px`);
    table.classList.toggle('responsive-horizontal-table', !usesPhoneCardLayout);
    /* A few legacy module rules use high-specificity !important declarations
       that compress wide tables on phones. Inline important sizing is scoped
       only to genuine horizontal tables so native touch scrolling always has
       overflow to move, while the phone card layouts remain unchanged. */
    if (usesPhoneCardLayout) {
      table.style.removeProperty('width');
      table.style.removeProperty('min-width');
      table.style.removeProperty('max-width');
      table.style.removeProperty('table-layout');
    } else {
      table.style.setProperty('width', `max(100%, ${minimumWidth}px)`, 'important');
      table.style.setProperty('min-width', `${minimumWidth}px`, 'important');
      table.style.setProperty('max-width', 'none', 'important');
      table.style.setProperty('table-layout', 'auto', 'important');
    }
    const shell = getOrCreateScrollShell(table);
    shell.setAttribute('tabindex', '0');
    shell.setAttribute('role', 'region');
    shell.setAttribute('aria-label', 'Jadual boleh dileret ke kiri dan kanan');
    decorateColumns(table);
  }

  function enhanceTables(root) {
    const tables = root instanceof HTMLTableElement ? [root] : Array.from(root.querySelectorAll?.('table') || []);
    tables.forEach(enhanceTable);
  }

  let enhancementFrame = 0;
  function scheduleEnhancement(root) {
    cancelAnimationFrame(enhancementFrame);
    enhancementFrame = requestAnimationFrame(() => enhanceTables(root || document));
  }

  function updateViewportClass() {
    const width = window.innerWidth;
    document.documentElement.classList.toggle('device-phone', width < 640);
    document.documentElement.classList.toggle('device-tablet', width >= 640 && width < 1024);
    document.documentElement.classList.toggle('device-desktop', width >= 1024);
  }

  function initializeResponsiveLayout() {
    updateViewportClass();
    enhanceTables(document);

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          scheduleEnhancement(document);
          break;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        updateViewportClass();
        enhanceTables(document);
      }, 100);
    }, { passive: true });
    window.addEventListener('orientationchange', () => window.setTimeout(updateViewportClass, 180), { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeResponsiveLayout, { once: true });
  } else {
    initializeResponsiveLayout();
  }
})();
