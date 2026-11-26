(function () {
  'use strict';

  var content = window.steadyContent;
  var benchmark = content.benchmark;
  var benchmarkRate = Number(((benchmark.endClose / benchmark.startClose - 1) * 100).toFixed(4));
  var products = content.products;
  var pageSearch = window.steadyPreviewSearch || location.search;
  var fundParam = pageSearch.match(/[?&]fund=(\d{6})(?:&|$)/);
  var requestedFund = fundParam ? fundParam[1] : '000606';
  var selected = products.filter(function (fund) { return fund.code === requestedFund; })[0] || products[0];
  if (/[?&]embedded=1(?:&|$)/.test(pageSearch)) {
    document.documentElement.classList.add('demo-embedded');
  }
  var overlay = document.getElementById('overlay');
  var sheet = overlay.querySelector('.sheet');
  var sheetTitle = document.getElementById('sheet-title');
  var sheetBody = document.getElementById('sheet-body');
  var closeButton = document.getElementById('close');
  var riskNotice = [
    '基于历史数据测算提升率，不代表产品到期的实际收益表现',
    '当前产品非保本保收益产品，可能发生净值波动'
  ].join('\n');
  var previousFocus;

  function element(tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = value;
    return node;
  }

  function percentage(value, digits) {
    return value === null ? '待核验' : value.toFixed(digits) + '%';
  }

  function holdingDays(fund) {
    return (Date.parse(fund.asOf) - Date.parse(fund.inception)) / 86400000;
  }

  function annualized(fund) {
    var days = holdingDays(fund);
    if (!isFinite(days) || days <= 0 || typeof fund.sinceInception !== 'number' ||
        !isFinite(fund.sinceInception) || fund.sinceInception < -100) return null;
    var result = (Math.pow(1 + fund.sinceInception / 100, 365 / days) - 1) * 100;
    return Number(result.toFixed(2));
  }

  function relativeGain(rate) {
    if (rate === null || !isFinite(benchmarkRate) || benchmarkRate <= 0) return null;
    return (rate / benchmarkRate - 1) * 100;
  }

  function comparisonFigure(parent, name, rate, digits, caption, variant, pixelsPerPoint) {
    var figure = element('div', 'metric ' + variant);
    figure.appendChild(element('p', 'metric-value', percentage(rate, digits)));
    figure.appendChild(element('p', 'meta', caption));
    var artwork = element('div', 'artwork');
    artwork.setAttribute('aria-hidden', 'true');
    if (rate !== null && rate >= 0) {
      var stack = element('span', 'column-stack');
      var base = element('span', 'cylinder');
      var baseRate = variant === 'fund' ? Math.min(rate, Math.max(0, benchmarkRate)) : rate;
      base.style.setProperty('--column-height', baseRate * pixelsPerPoint + 'px');
      stack.appendChild(base);
      if (rate > baseRate) {
        var increase = element('span', 'cylinder-increase');
        increase.style.setProperty('--column-height', (rate - baseRate) * pixelsPerPoint + 'px');
        stack.appendChild(increase);
      }
      artwork.appendChild(stack);
    }
    figure.appendChild(artwork);
    figure.appendChild(element('h2', 'metric-name', name));
    parent.appendChild(figure);
    return figure;
  }

  function renderComparison() {
    var root = document.getElementById('comparison');
    var rate = annualized(selected);
    var relative = relativeGain(rate);
    var summary = '收益对照待核验';
    if (relative !== null) {
      var rounded = Math.round(Math.abs(relative));
      summary = rounded === 0 ? '与指数基本持平' :
        (relative > 0 ? '追求收益提升' : '测算低于指数') + rounded + '%';
    }
    var heading = document.getElementById('comparison-title');
    heading.textContent = '持有' + selected.term + '，';
    var accent = element('span', 'headline-accent', summary);
    if (relative !== null && Math.round(Math.abs(relative)) > 0) {
      var uplift = Math.round(Math.abs(relative)) + '%';
      accent.textContent = summary.slice(0, -uplift.length);
      accent.appendChild(element('strong', 'headline-value', uplift));
    }
    heading.appendChild(accent);
    root.textContent = '';
    var maximumRate = products.reduce(function (maximum, fund) {
      return Math.max(maximum, annualized(fund) || 0);
    }, benchmarkRate);
    var pixelsPerPoint = maximumRate > 0 ? 94 / maximumRate : 0;
    var left = comparisonFigure(root, benchmark.name, benchmarkRate, 2,
      '近一年净值增长', 'benchmark', pixelsPerPoint);
    var arrow = element('span', 'comparison-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    left.querySelector('.artwork').appendChild(arrow);
    var right = comparisonFigure(root, '持有' + selected.term + '产品', rate, 2,
      '成立以来年化增长', 'fund', pixelsPerPoint);

    var examples = element('div', 'examples');
    examples.appendChild(element('span', 'examples-label', '代表产品：'));
    benchmark.examples.forEach(function (item) {
      var entry = element('span', 'chip', item.name);
      entry.title = item.type;
      examples.appendChild(entry);
    });
    left.appendChild(examples);
    var fundName = element('div', 'examples fund-examples');
    fundName.appendChild(element('span', 'chip fund-chip', selected.name + ' ' + selected.code));
    var details = element('button', 'details-link', '详情>');
    details.type = 'button';
    details.onclick = function () { openCmbFund(selected.code, 'detail'); };
    fundName.appendChild(details);
    right.appendChild(fundName);

  }

  function renderProducts() {
    var root = document.getElementById('products');
    products.forEach(function (fund) {
      var row = element('label', 'product available');
      var performance = element('span', 'product-rate');
      performance.appendChild(element('strong', '', percentage(annualized(fund), 2)));
      performance.appendChild(element('span', 'meta', '成立以来年化增长'));
      row.appendChild(performance);

      var names = element('span', 'product-name');
      var term = element('span', 'term-line');
      term.appendChild(element('strong', '', fund.term));
      if (fund.flexible) term.appendChild(element('span', 'flexible-tag', '灵活申赎'));
      names.appendChild(term);
      names.appendChild(element('span', 'meta', fund.risk || '招行评级待核验'));
      row.appendChild(names);

      var input = element('input');
      input.type = 'radio';
      input.name = 'product';
      input.value = fund.code;
      input.checked = fund === selected;
      input.setAttribute('aria-label', fund.term + '档 ' + fund.name);
      input.onchange = function () {
        if (!input.checked) return;
        selected = fund;
        renderComparison();
      };
      row.appendChild(input);
      root.appendChild(row);
    });
  }

  function addFacts(facts, container) {
    var list = element('dl');
    facts.forEach(function (fact) {
      list.appendChild(element('dt', '', fact[0]));
      list.appendChild(element('dd', '', fact[1]));
    });
    (container || sheetBody).appendChild(list);
  }

  function renderFormula() {
    addFacts([
      ['指数近一年涨幅', '（期末指数收盘点位 ÷ 期初指数收盘点位 − 1）× 100%'],
      ['产品成立以来年化增长', '［（1 ＋ 成立以来累计收益率）^(365 ÷ 实际存续天数) − 1］× 100%'],
      ['收益提升率', '（产品成立以来年化增长率 ÷ 指数近一年涨幅 − 1）× 100%'],
      ['数据来源', 'iFinD（指数收盘点位及基金复权净值收益率）。'],
      ['风险提示', riskNotice]
    ]);
  }

  function openCmbFund(code, kind) {
    if (!/^\d{6}$/.test(code)) return;
    var url = kind === 'buy'
      ? 'https://jump.m.cmbchina.com/8R49hVCG?_pu=144&FundCode=' + code + '&popup=true&Amount=10000'
      : 'https://mobile.cmbchina.com/IFundPrds/fund-product/fund-detail.html?fundCode=' + code;
    if (window.cmblapiBridge && window.cmblapi && typeof window.cmblapi.pushWindow === 'function') {
      window.cmblapi.pushWindow({ url: url, windowControl: '1', fail: function () { openSheet(kind); } });
    } else if (kind === 'buy' && window.cmblapiBridge) {
      window.location.assign(url);
    } else {
      openSheet(kind);
    }
  }

  function shareText() {
    return ['稳健理财｜天弘基金出品',
      document.getElementById('comparison-title').textContent,
      selected.name + '（' + selected.code + '） · 成立以来年化增长 ' +
        percentage(annualized(selected), 2),
      riskNotice
    ].join('\n');
  }

  function renderShare() {
    sheetTitle.textContent = '分享到';
    var choices = element('div', 'share-choices');
    ['微信', '朋友圈'].forEach(function (target, index) {
      var option = element('button', 'share-option');
      option.type = 'button';
      var icon = element('span', 'channel-icon ' + (index === 0 ? 'wechat-icon' : 'moments-icon'));
      icon.setAttribute('aria-hidden', 'true');
      icon.appendChild(element('span', '', index === 0 ? '••' : ''));
      option.appendChild(icon);
      option.appendChild(element('span', '', target));
      option.onclick = function () {
        var payload = { title: '稳健理财', text: shareText() };
        if (location.protocol === 'https:') {
          var url = new URL(location.href);
          url.searchParams.delete('embedded');
          url.searchParams.set('fund', selected.code);
          payload.url = url.href;
        }
        if (navigator.share) {
          navigator.share(payload).then(closeSheet, function (error) {
            if (error.name !== 'AbortError') renderShareSummary(target, payload);
          });
        } else {
          renderShareSummary(target, payload);
        }
      };
      choices.appendChild(option);
    });
    sheetBody.appendChild(choices);
  }

  function renderShareSummary(target, payload) {
    sheetBody.textContent = '';
    sheetTitle.textContent = target;
    sheetBody.appendChild(element('p', 'share-hint', '复制摘要后可以粘贴到' + target + '。'));
    var field = element('textarea', 'share-summary');
    field.readOnly = true;
    field.setAttribute('aria-label', '分享摘要');
    field.value = payload.text + (payload.url ? '\n' + payload.url : '');
    sheetBody.appendChild(field);
    var copy = element('button', 'copy-share', '复制摘要');
    copy.type = 'button';
    copy.onclick = function () {
      function selectText() {
        field.focus();
        field.select();
        copy.textContent = '请复制已选中的摘要';
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(field.value).then(function () {
          copy.textContent = '已复制';
        }, selectText);
      } else {
        selectText();
      }
    };
    sheetBody.appendChild(copy);
    copy.focus();
  }

  function openSheet(kind) {
    previousFocus = document.activeElement;
    sheetBody.textContent = '';
    sheet.className = 'sheet ' + (kind === 'share' ? 'share-sheet' : 'method-sheet');
    var dismiss = document.getElementById('dismiss-share');
    dismiss.hidden = kind !== 'share';
    closeButton.textContent = kind === 'method' ? '我知道了' : kind === 'share' ? '取消' : '关闭';
    if (kind === 'method') {
      sheetTitle.textContent = '计算说明';
      renderFormula();
    } else if (kind === 'share') {
      renderShare();
    } else if (kind === 'buy') {
      sheetTitle.textContent = '基金购买';
      sheetBody.appendChild(element('p', '', selected.name + ' ' + selected.code));
      sheetBody.appendChild(element('p', '', '请在招商银行 App 内打开购买页。'));
    } else {
      sheetTitle.textContent = '基金详情';
      sheetBody.appendChild(element('p', '', '请在招商银行 App 内查看。'));
    }
    overlay.hidden = false;
    document.querySelector('.page').style.overflow = 'hidden';
    sheet.scrollTop = 0;
    closeButton.focus();
  }

  function closeSheet() {
    overlay.hidden = true;
    document.querySelector('.page').style.overflow = '';
    if (previousFocus) previousFocus.focus();
  }

  var back = document.getElementById('back');
  renderComparison();
  renderProducts();
  back.disabled = !document.referrer || history.length < 2;
  back.onclick = function () { history.back(); };
  document.querySelector('[data-sheet="method"]').onclick = function () { openSheet('method'); };
  document.getElementById('share').onclick = function () { openSheet('share'); };
  document.getElementById('dismiss-share').onclick = closeSheet;
  document.getElementById('confirm').onclick = function () {
    openCmbFund(selected.code, 'buy');
  };
  closeButton.onclick = closeSheet;
  overlay.onclick = function (event) {
    if (event.target === overlay) closeSheet();
  };
  document.addEventListener('keydown', function (event) {
    if (overlay.hidden) return;
    if (event.keyCode === 27) closeSheet();
    if (event.keyCode !== 9) return;
    var focusable = overlay.querySelectorAll('button:not([hidden]), a[href], textarea');
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
