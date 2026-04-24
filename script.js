'use strict';

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', () => {
  // 自動填入今天日期 YYMMDD
  const today = new Date();
  const yy = String(today.getFullYear()).slice(2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  document.getElementById('campaign_date').value = yy + mm + dd;

  // campaign preview 即時更新觸發欄位
  ['campaign_date', 'event_name', 'product_name'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateCampaignPreview);
  });

  // Enter 鍵觸發產生
  ['campaign_date', 'event_name', 'product_name', 'creative_name', 'audience_name', 'landing_url'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') generateUTM();
    });
  });

  // 初始預覽
  updateCampaignPreview();
});

// ===== 參數規格化 =====
// 1. 前後去空白  2. 全轉小寫  3. 空格 → 底線

function normalizeParam(str) {
  return str.trim().toLowerCase().replace(/\s+/g, '_');
}

// ===== 即時預覽 campaign =====

function updateCampaignPreview() {
  const date    = document.getElementById('campaign_date').value.trim();
  const event   = normalizeParam(document.getElementById('event_name').value);
  const product = normalizeParam(document.getElementById('product_name').value);
  const preview = document.getElementById('campaign-preview');

  if (!date && !event && !product) {
    preview.textContent = '—';
    preview.classList.remove('preview-ready', 'preview-error');
    return;
  }

  const parts = [date, event, product].filter(Boolean);
  const val = parts.join('_');
  preview.textContent = val;

  const hasError = containsUTMKeyword(val) || containsFullWidth(val) || !isValidDateFormat(date);
  if (hasError) {
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

  // ── 0. 讀取 → 規格化 ──
  const dateRaw     = document.getElementById('campaign_date').value.trim();
  const campaignRaw = normalizeParam(document.getElementById('event_name').value);
  const productRaw  = normalizeParam(document.getElementById('product_name').value);
  const creativeRaw = normalizeParam(document.getElementById('creative_name').value);
  const audienceRaw = document.getElementById('audience_name').value.trim(); // 保留原始大小寫供驗證
  const audienceNorm = normalizeParam(audienceRaw);
  const landingRaw  = document.getElementById('landing_url').value.trim();
  const debugMode   = document.getElementById('debug_mode').checked;

  // 規格化後寫回
  document.getElementById('event_name').value    = campaignRaw;
  document.getElementById('product_name').value  = productRaw;
  document.getElementById('creative_name').value = creativeRaw;
  document.getElementById('audience_name').value = audienceNorm;
  updateCampaignPreview();

  // ── 1. 必填空值檢查 ──
  const fields = [
    { id: 'campaign_date',  label: '日期',     value: dateRaw },
    { id: 'event_name',     label: '活動名稱', value: campaignRaw },
    { id: 'product_name',   label: '商品名稱', value: productRaw },
    { id: 'creative_name',  label: '素材名稱', value: creativeRaw },
    { id: 'audience_name',  label: '受眾描述', value: audienceNorm },
  ];
  const emptyFields = fields.filter(f => !f.value);
  if (emptyFields.length > 0) {
    emptyFields.forEach(f => markError(f.id));
    showError('請填寫所有必填欄位：' + emptyFields.map(f => f.label).join('、'));
    return;
  }

  // ── 2. 日期格式驗證（YYMMDD，6位數字）──
  if (!isValidDateFormat(dateRaw)) {
    markError('campaign_date');
    showError('日期格式錯誤，請輸入 6 位數字，例如：260424');
    return;
  }

  // ── 3. utm= 字樣檢查 ──
  const utmCheckFields = [
    { id: 'event_name',    label: '活動名稱', value: campaignRaw },
    { id: 'product_name',  label: '商品名稱', value: productRaw },
    { id: 'creative_name', label: '素材名稱', value: creativeRaw },
    { id: 'audience_name', label: '受眾描述', value: audienceNorm },
  ];
  const utmViolations = utmCheckFields.filter(f => containsUTMKeyword(f.value));
  if (utmViolations.length > 0) {
    utmViolations.forEach(f => markError(f.id));
    showError('欄位值不可包含 utm= 字樣（' + utmViolations.map(f => f.label).join('、') + '）');
    return;
  }

  // ── 4. 全形符號檢查 ──
  const fwViolations = utmCheckFields.filter(f => containsFullWidth(f.value));
  if (fwViolations.length > 0) {
    fwViolations.forEach(f => markError(f.id));
    showError('不可使用全形符號，請改為半形（' + fwViolations.map(f => f.label).join('、') + '）');
    return;
  }

  // ── 5. utm_term 受眾關鍵字驗證 ──
  const termKeywords = ['新客', 'atc', '收單', '舊客', '再行銷', '海外'];
  const termNormLower = audienceNorm.toLowerCase();
  const hasValidTermKeyword = termKeywords.some(kw => termNormLower.includes(kw.toLowerCase()));
  if (!hasValidTermKeyword) {
    markError('audience_name');
    showError('受眾描述必須包含以下其中一個關鍵字：新客 / ATC / 收單 / 舊客 / 再行銷 / 海外');
    return;
  }

  // ── 6. URL 驗證 ──
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

  // ── 7. Landing URL 已含 UTM 檢查 ──
  if (landingAlreadyHasUTM(landingRaw)) {
    markError('landing_url');
    showError('Landing Page URL 已包含 utm_ 參數，請移除後再產生，避免重複');
    return;
  }

  // ── 8. 組合 utm_campaign ──
  const utmCampaign = [dateRaw, campaignRaw, productRaw].join('_');

  // ── 9. 組合 UTM 參數串 ──
  const utmParts = [
    'utm_source=facebook',
    'utm_medium=ads',
    `utm_campaign=${encodeURIComponent(utmCampaign)}`,
    `utm_content=${encodeURIComponent(creativeRaw)}`,
    `utm_term=${encodeURIComponent(audienceNorm)}`,
  ];
  if (debugMode) utmParts.push('debug_mode=true');

  const utmString = utmParts.join('&');

  // ── 10. 91APP 特殊處理 ──
  const is91APP = landingRaw.includes('/v2/official/');
  let fullURL;

  if (is91APP) {
    const qIndex = landingRaw.indexOf('?');
    if (qIndex === -1) {
      fullURL = landingRaw + '?' + utmString;
    } else {
      const base           = landingRaw.slice(0, qIndex);
      const existingParams = landingRaw.slice(qIndex + 1);
      fullURL = base + '?' + utmString + '&' + existingParams;
    }
  } else {
    const separator = landingRaw.includes('?') ? '&' : '?';
    fullURL = landingRaw + separator + utmString;
  }

  // ── 11. 輸出結果 ──
  document.getElementById('out-campaign').textContent  = utmCampaign;
  document.getElementById('out-content').textContent   = creativeRaw;
  document.getElementById('out-term').textContent      = audienceNorm;
  document.getElementById('out-utm-string').textContent = utmString;
  document.getElementById('out-full-url').textContent  = fullURL;

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
    btn.textContent = isMain ? '✅ 已複製！' : '✅ 複製成功';
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

function isValidDateFormat(str) {
  return /^\d{6}$/.test(str);
}

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
