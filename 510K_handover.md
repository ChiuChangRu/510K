# 510(k) Explorer — 交接文件 (Handover)

> FDA 510(k) Performance Test Explorer
> 最後更新: 2026-06-24 by Claude session

---

## 1. 專案概要

單頁 Web 工具,查 FDA 510(k) 已清關器材並用 AI 擷取 **功能性/驗證測試項目**,供 predicate / FTO / 測試計畫分析。

- **Repo**: `ChiuChangRu/510K` (branch `main`)
- **部署**: GitHub Pages → `https://chiuchangru.github.io/510K/`
- **架構**: 單一 `index.html`(HTML + CSS + 原生 JS,**無後端**),內嵌 pdf.js CDN
- **資料源**: openFDA API (`https://api.fda.gov`,免費、無 key)+ Anthropic API (測試項目擷取/翻譯/綜整)

---

## 2. 開發/部署工作規則 (沿用,務必遵守)

1. 改 HTML 用 **inline Python `str.replace()`**(精準控制引號/template literal),不要用易碎的逐行編輯。
2. 每次改完驗證三件事:
   - **Node 語法檢查**:抽出 `<script>` 內容跑 `node --check`
   - **`grep -c "邦特"` 必須為 0**(此 repo 為對外競品工具,不可出現公司名)
   - 確認改動落點(grep 關鍵函式/變數)
3. **commit history 即 rollback 機制**,出錯就還原。
4. GitHub API 寫入前先抓 **fresh SHA**。

---

## 3. 三步驟資料流

| Step | 功能 | 端點 / 機制 | 關鍵函式 |
|---|---|---|---|
| 1 | 查 Product Code | `GET /device/classification.json?search=...` | `searchCode()` 區 (~L520-600) |
| 2 | 載入 510(k) 清單 | `GET /device/510k.json?search=product_code:"X"+AND+decision_date:[...]` | `loadKList()` (~L660) |
| 3 | 擷取測試項目 | Anthropic `/v1/messages` (model `claude-sonnet-4-6`) | `analyzeSelected()` (~L960) |

**Step 3 兩條路徑**:
- 有設 Proxy URL → `analyzeViaPdf()`:經 proxy 抓 PDF → pdf.js 取文字 → `claudeExtract()` 丟全文給 Claude。
- 無 Proxy → `analyzeViaName()`:僅用器材名讓 Claude **推斷**測試項目(較粗略)。

**綜整**:全部分析完後 `buildSynthesis()` 再呼叫一次 Claude,把多筆測試項目**去重分類**成矩陣 (`renderMatrix()`)。

---

## 4. API Key / CORS / Proxy (重要)

- **唯一真正金鑰 = Anthropic `sk-ant-`**,存於瀏覽器 `localStorage` (`fda_api_key`),輸入一次即記住。
- 直接從瀏覽器打 `api.anthropic.com` **必須帶** header `anthropic-dangerous-direct-browser-access: "true"`,否則 CORS 擋下回報 `Failed to fetch`。目前兩處 fetch (L509, L1040) 都已帶。
- 此 header 適用**自用階段**(key 本就在瀏覽器)。
- **公開前必做**:改走 **Cloudflare Worker / Vercel proxy**,把 `sk-ant` 放伺服器端,前端不帶 key,並保留前門 `Password` 閘門 + proxy 端流量限制,否則公開網站會被刷爆額度。
- `proxy-url` 欄位已存在 (`localStorage: fda_proxy`);`PROXY_TOKEN` 常數已在程式中。
- openFDA 目前**裸打無 key**。可加 openFDA key(只管 rate limit、可安全內建)把每日上限 1,000 → 120,000,壓掉 429/404 雜訊。**尚未實作**。

---

## 5. 本機快取 (localStorage) — 省 API 的核心

- **Key**: `fda510k_reports` → `{ [k_number]: entry }`
- **entry schema**:
  ```json
  {
    "k_number": "K180450",
    "product_code": "KNW",
    "device_name": "Corvocet Biopsy System",
    "device_name_zh": "...",          // 來自 zhNameCache
    "applicant": "Merit Medical Systems, Inc.",
    "models": ["863212100", ...],      // 從 device_name 啟發式抽取
    "decision_date": "2018-03-12",
    "tests": [{ "en": "...", "zh": "..." }],
    "pdf_url": "https://...",
    "analyzed_at": "2026-06-24T..."
  }
  ```
- **流程**: `analyzeSelected()` 每筆分析前先 `getCachedReport(knum)`,**命中就 0 API**;新分析成功才 `saveReport(entry)`。
- **回溯檢索**: 頁面標題下「已分析紀錄」面板 → 下拉選單 (`populateHistSelect`) + 搜尋框 (`renderHistory`,跨 代碼/中文名/英文名/廠牌/型號 比對) → 點選 `loadHistory(knum)` 叫回報告(0 API)。
- 快取存於**單一瀏覽器**,清瀏覽資料會清掉。**公開時應改存伺服器端**,變成全站共享知識庫(可接 LitDB 方向)。

---

## 6. 本次 session 變更紀錄 (changelog)

1. **配色重做 (dark mode)**: 暖褐底 `#1a1512` → 中性深 `#0f1115/#181b22`;強調橘提亮 `#c04a18` → `#ea580c`;`.zh-tag` 翻譯標籤由橘框改為次要灰字無框。橘色現只用於按鈕/作用中步驟/K-number。
2. **勾選移到每列最前** (`.k-item` grid `auto 76px 1fr` + template 調序)。
3. **修 `Failed to fetch`**: 兩處 Anthropic fetch 補上 `anthropic-dangerous-direct-browser-access` header。
4. **Step 3 報表重做**: 測試項目橘 pill → 安靜分行清單;新增 **器材總覽表** + **驗證項目綜整矩陣**(`buildSynthesis`/`renderMatrix`,多一次 Claude 呼叫,失敗降級)。
5. **localStorage 快取 + 回溯檢索**(見 §5)。
6. **下拉清單**選取已分析紀錄。
7. **修 Class 篩選 bug**: 510(k) 紀錄類別在 `r.openfda.device_class`(常為陣列),原本讀 `r.device_class` 永遠空 → 選任何 class 全空。已改為讀 `openfda.device_class` 並處理陣列。

---

## 7. 待辦 / 已知問題 (TODO backlog)

- [ ] **快取管理 UI**:單筆刪除、強制重新分析(改 prompt 後現會一直吃舊快取)、匯出整個快取 JSON 備份。
- [ ] **匯出綜整矩陣**(目前 Export CSV/MD 只匯出個別項目,矩陣無法匯出)。
- [ ] **openFDA key** 內建以提高 rate limit。
- [ ] **公開部署**:Cloudflare Worker proxy(伺服器端持 key)+ 共享快取。
- [ ] **型號抽取為啟發式**(regex 抓長數字 catalog 碼),非結構化欄位,可能漏抓/誤抓。
- [ ] **light mode 的 `.zh-tag`** 也已一併改為灰字(若想 light 保留橘框需用 `@media` 拆兩套)。
- [ ] `analyzeViaName`(無 proxy)僅憑器材名推斷,準確度有限;有 proxy 抓 PDF 全文較準。

---

## 8. 快速參考 — 關鍵全域/函式

| 名稱 | 用途 |
|---|---|
| `selectedCode` | 目前選定 product code |
| `kDataAll` / `kData` | 510(k) 全集 / 篩選後 |
| `activeFilters` | `{ class, doc, reg }` 篩選集合 |
| `zhNameCache` | k_number → 器材中文名 |
| `analysisResults` | 本次分析結果陣列 |
| `getKey()` / `getProxy()` | 讀 API key / proxy URL |
| `claudeCall(prompt, key)` | 統一的 Anthropic 呼叫(含 JSON 解析/降級) |
| `loadReports/saveReport/getCachedReport` | 快取讀寫 |
| `buildSynthesis / renderMatrix` | 綜整矩陣 |
| `renderHistory / populateHistSelect / loadHistory` | 回溯檢索 |
| `unlockPanel(id)` | 解鎖 panel2/panel3 |

> 行號為近似值,改動後請以 `grep` 重新定位。
