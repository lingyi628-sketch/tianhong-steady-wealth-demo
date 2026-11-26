(function () {
  'use strict';

  var content = window.steadyContent;
  var benchmark = content.benchmark;
  var products = content.products;
  var fundParam = location.search.match(/[?&]fund=(\d{6})(?:&|$)/);
  var requestedFund = fundParam ? fundParam[1] : '000606';
  var selected = products.filter(function (fund) { return fund.code === requestedFund; })[0] || products[0];
  if (/[?&]embedded=1(?:&|$)/.test(location.search)) {
    document.documentElement.classList.add('demo-embedded');
  }
  var overlay = document.getElementById('overlay');
  var sheet = overlay.querySelector('.sheet');
  var sheetTitle = document.getElementById('sheet-title');
  var sheetBody = document.getElementById('sheet-body');
  var closeButton = document.getElementById('close');
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

  function annualized(fund) {
    var days = (Date.parse(fund.asOf) - Date.parse(fund.inception)) / 86400000;
    if (!isFinite(days) || days <= 0 || typeof fund.sinceInception !== 'number' ||
        !isFinite(fund.sinceInception) || fund.sinceInception < -100) return null;
    var result = (Math.pow(1 + fund.sinceInception / 100, 365 / days) - 1) * 100;
    return Number(result.toFixed(2));
  }

  function relativeGain(rate) {
    if (rate === null || !isFinite(benchmark.rate) || benchmark.rate <= 0) return null;
    return (rate / benchmark.rate - 1) * 100;
  }

  function comparisonFigure(parent, name, rate, digits, caption, variant, pixelsPerPoint) {
    var figure = element('div', 'metric ' + variant);
    figure.appendChild(element('p', 'metric-value', percentage(rate, digits)));
    figure.appendChild(element('p', 'meta', caption));
    var artwork = element('div', 'artwork');
    artwork.setAttribute('aria-hidden', 'true');
    if (rate !== null && rate >= 0) {
      var cylinder = element('span', 'cylinder');
      var height = rate * pixelsPerPoint;
      cylinder.style.height = height + 'px';
      if (variant === 'fund' && rate > benchmark.rate) {
        var increase = element('span', 'cylinder-increase');
        increase.style.height = ((rate - benchmark.rate) * pixelsPerPoint) + 'px';
        cylinder.className += ' stacked';
        cylinder.appendChild(increase);
      }
      artwork.appendChild(cylinder);
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
    }, benchmark.rate);
    var pixelsPerPoint = maximumRate > 0 ? 63 / maximumRate : 0;
    var left = comparisonFigure(root, benchmark.name, benchmark.rate, 4,
      '近一年净值增长', 'benchmark', pixelsPerPoint);
    var arrow = element('span', 'comparison-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    root.appendChild(arrow);
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
    var fundName = element('div', 'examples');
    fundName.appendChild(element('span', 'chip fund-chip', selected.name));
    fundName.appendChild(element('span', 'fund-code', selected.code));
    right.appendChild(fundName);

    var note = document.getElementById('comparison-note');
    note.textContent = '';
    note.appendChild(element('span', '', '基于历史数据测算提升率，不代表产品到期的实际收益表现'));
    note.appendChild(element('span', '', '当前产品非保本保收益产品，可能发生净值波动'));
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

  function addFacts(facts) {
    var list = element('dl');
    facts.forEach(function (fact) {
      list.appendChild(element('dt', '', fact[0]));
      list.appendChild(element('dd', '', fact[1]));
    });
    sheetBody.appendChild(list);
  }

  function addLink(label, url) {
    var link = element('a', '', label);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    var row = element('p');
    row.appendChild(link);
    sheetBody.appendChild(row);
  }

  function renderFormula(rate) {
    var formula = element('div', 'formula');
    formula.appendChild(element('span', '', '('));
    var fraction = element('span', 'fraction');
    fraction.appendChild(element('span', '', '产品收益率'));
    fraction.appendChild(element('span', '', '货币基金指数收益率'));
    formula.appendChild(fraction);
    formula.appendChild(element('span', '', '− 1) × 100%'));
    sheetBody.appendChild(formula);
    var relative = relativeGain(rate);
    if (relative !== null) {
      sheetBody.appendChild(element('p', 'calculation', selected.name + ' · (' + percentage(rate, 2) +
        ' ÷ ' + percentage(benchmark.rate, 4) + ' − 1) × 100% ≈ ' + percentage(relative, 2)));
    }
    addFacts([
      ['货币基金指数近一年净值增长', percentage(benchmark.rate, 4) + ' · 截止日未提供 · 参考图示例'],
      ['基金成立以来年化增长', selected.inception + ' 至 ' + (selected.asOf || '待核验') +
        ' · ' + selected.displaySource],
      ['收益提升率', '按上述两项数据测算，随所选产品更新'],
      ['招商银行风险等级', '查询日期 ' + content.riskAsOf]
    ]);
    sheetBody.appendChild(element('p', '', '过往业绩不预示未来收益，测算结果不反映实际持有收益。债券基金非保本保收益，净值可能波动，投资须谨慎。'));
  }

  function shareText() {
    return ['稳健理财｜天弘基金出品',
      document.getElementById('comparison-title').textContent,
      selected.name + '（' + selected.code + '） · 成立以来年化增长 ' +
        percentage(annualized(selected), 2),
      document.getElementById('comparison-note').innerText
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
    sheet.className = 'sheet' + (kind === 'method' ? ' method-sheet' : kind === 'share' ? ' share-sheet' : '');
    var dismiss = document.getElementById('dismiss-share');
    dismiss.hidden = kind !== 'share';
    closeButton.textContent = kind === 'method' ? '我知道了' : kind === 'share' ? '取消' : '关闭';
    var rate = annualized(selected);
    if (kind === 'method') {
      sheetTitle.textContent = '收益对照计算公式';
      renderFormula(rate);
    } else if (kind === 'share') {
      renderShare();
    } else {
      sheetTitle.textContent = selected.name;
      addFacts([
        ['基金全称', selected.fullName],
        ['基金代码', selected.code],
        ['页面档位', selected.term],
        ['产品实际持有规则', selected.holding],
        ['招商银行风险等级', selected.risk || '待核验'],
        ['招行评级查询日期', content.riskAsOf],
        ['份额成立日期', selected.inception],
        ['净值日期', selected.asOf || '待核验'],
        ['数据来源', selected.displaySource],
        ['成立以来累计净值增长', percentage(selected.sinceInception, 2)],
        ['成立以来年化增长（折算）', percentage(rate, 2)]
      ]);
      sheetBody.appendChild(element('p', '', '年化增长按（1＋成立以来累计增长率）^(365÷实际存续天数)－1计算。'));
      addLink('招商银行产品统一查询平台', 'https://finprod.paas.cmbchina.com/');
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

  renderComparison();
  renderProducts();
  var back = document.getElementById('back');
  back.disabled = !document.referrer || history.length < 2;
  back.onclick = function () { history.back(); };
  document.querySelector('[data-sheet="method"]').onclick = function () { openSheet('method'); };
  document.getElementById('share').onclick = function () { openSheet('share'); };
  document.getElementById('dismiss-share').onclick = closeSheet;
  document.getElementById('confirm').onclick = function () { openSheet('fund'); };
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
