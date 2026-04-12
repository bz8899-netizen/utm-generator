'use strict';

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('event_name').addEventListener('input', updateCampaignPreview);

  ['event_name', 'creative_name', 'audience_name', 'landing_url'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') generateUTM();
    });
  });
});

// ===== 即時預覽 campaign =====

function updateCampaignPreview() {
  const val     = document.getElementById('event_name').value.trim();
  const preview = document.getElementById('campaign-preview');

  if (!val) {
    preview.textContent = '—';
    preview.classList.remove('preview-ready', 'preview-error');
    return;
  }

  preview.textContent = val;

  if (containsUTMKeyword(val) || containsFullWidth(val)) {
    preview.classList.add('preview-error');
    preview.classList.remove('preview-ready');
  } else {
    preview.classList.add('preview-ready');
    preview.classList.remove('preview-error');
  }
}

// ===== 核心邏輯 =====

function generateUTM() {
  clearErrors();

  const campaignRaw = document.getElementById('event_name').value.trim();
  const creativeRaw = document.getElementById('creative_name').value.trim();
  const audienceRaw = document.getElementById('audience_name').value.trim();
  const landingRaw  = document.getElementById('landing_url').value.trim();
  const debugMode   = document.getElementById('debug_mode').checked;

  // ── 1. 空值檢查 ──
  const fields = [
    { id: 'event_name',    label: '活動名稱', value: campaignRaw },
    { id: 'creative_name', label: '素材名稱', value: creativeRaw },
    { id: 'audience_name', label: '受眾描述', value: audienceRaw },
  ];
  const emptyFields = fields.filter(f => !f.value);
  if (emptyFields.length > 0) {
    emptyFields.forEach(f => markError(f.id));
    showError('請填寫所有必填欄位：' + emptyFields.map(f => f.label).join('、'));
    return;
  }

  // ── 2. utm= 字樣檢查 ──
  const utmViolations = fields.filter(f => containsUTMKeyword(f.value));
  if (utmViolations.length > 0) {
    utmViolations.forEach(f => markError(f.id));
    showError('欄位值不可包含 utm= 字樣（' + utmViolations.map(f => f.label).join('、') + '）');
    return;
  }

  // ── 3. 全形符號檢查 ──
  const fwViolations = fields.filter(f => containsFullWidth(f.value));
  if (fwViolations.length > 0) {
    fwViolations.forEach(f => markError(f.id));
    showError('不可使用全形符號，請改為半形（' + fwViolations.map(f => f.label).join('、') + '）');
    return;
  }

  // ── 4. URL 驗證 ──
  if (!landingRaw) {
    markError('landing_url');
    showError('請填入 Landing Page URL');
    return;
  }
  if (!isValidURL(landingRaw)) {
    markError('landing_url');
    showError('URL 格式不正確，請輸入完整網址（例如：https://example.com）');
    return;
  }

  // ── 5. Landing URL 已含 UTM 檢查 ──
  if (landingAlreadyHasUTM(landingRaw)) {
    markError('landing_url');
    showError('Landing Page URL 已包含 utm_ 參數，請移除後再產生，避免重複');
    return;
  }

  // ── 6. 組合 UTM 參數串 ──
  const utmParts = [
    'utm_source=facebook',
    'utm_medium=ads',
    `utm_campaign=${encodeURIComponent(campaignRaw)}`,
    `utm_content=${encodeURIComponent(creativeRaw)}`,
    `utm_term=${encodeURIComponent(audienceRaw)}`,
  ];
  if (debugMode) utmParts.push('debug_mode=true');

  const utmString = utmParts.join('&');

  // ── 7. 91APP 特殊處理 ──
  // /v2/official/ 路徑可能因跳轉洗掉尾部參數，UTM 需排在最前面
  const is91APP = landingRaw.includes('/v2/official/');
  let fullURL;

  if (is91APP) {
    const qIndex = landingRaw.indexOf('?');
    if (qIndex === -1) {
      // 無原有參數
      fullURL = landingRaw + '?' + utmString;
    } else {
      // 有原有參數 → UTM 排在前面，原有參數接後面
      const base         = landingRaw.slice(0, qIndex);
      const existingParams = landingRaw.slice(qIndex + 1);
      fullURL = base + '?' + utmString + '&' + existingParams;
    }
  } else {
    // 一般 URL：UTM 接在後面
    const separator = landingRaw.includes('?') ? '&' : '?';
    fullURL = landingRaw + separator + utmString;
  }

  // ── 8. 輸出結果 ──
  document.getElementById('out-campaign').textContent = campaignRaw;
  document.getElementById('out-content').textContent  = creativeRaw;
  document.getElementById('out-term').textContent     = audienceRaw;
  document.getElementById('out-full-url').textContent = fullURL;

  // 91APP 提示
  const notice91 = document.getElementById('notice-91app');
  notice91.style.display = is91APP ? 'block' : 'none';

  const resultSection = document.getElementById('result-section');
  resultSection.style.display = 'block';
  setTimeout(() => {
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

// ===== 複製功能 =====

function copyValue(elementId, btn) {
  const text = document.getElementById(elementId).textContent;
  if (!text) return;

  const doFallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  };

  const showCopied = () => {
    const isMain = btn.classList.contains('btn-copy-main');
    const original = btn.textContent;
    btn.textContent = isMain ? '已複製 ✓' : '已複製 ✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 2000);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(showCopied).catch(() => { doFallback(); showCopied(); });
  } else {
    doFallback();
    showCopied();
  }
}

// ===== 驗證函式 =====

function containsUTMKeyword(str) {
  return /utm[_=]/i.test(str);
}

function containsFullWidth(str) {
  return /[\uFF01-\uFF60\uFFE0-\uFFE6]/.test(str);
}

function landingAlreadyHasUTM(url) {
  return /[?&]utm_/i.test(url);
}

function isValidURL(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

// ===== UI 輔助 =====

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = '⚠ ' + msg;
  el.classList.add('visible');
}

function clearErrors() {
  const el = document.getElementById('error-msg');
  el.textContent = '';
  el.classList.remove('visible');
  document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

function markError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('error');
}
