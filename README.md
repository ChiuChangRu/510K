# FDA 510(k) Performance Test Explorer

依器材類型查詢 FDA 已清關的 510(k) 產品，並透過 AI 自動擷取每份 510(k) Summary 中的功能性測試項目。

**Live demo:** `https://ChiuChangRu.github.io/fda510k/`

---

## 功能

- **Step 1** — 輸入器材關鍵字（英文），查詢對應的 FDA Product Code
- **Step 2** — 依 Product Code 撈出所有 510(k) 清單，支援年份篩選
- **Step 3** — 選取多筆 K-number，AI 從 PDF Summary 解析功能性測試項目（含 ISO / ASTM 標準號）
- 支援匯出 **JSON / CSV / Markdown**
- Dark mode 自動切換

---

## 快速開始

### 1. Fork 並啟用 GitHub Pages

```
Settings → Pages → Source: Deploy from branch → main / root
```

### 2. 取得 Anthropic API Key

前往 [console.anthropic.com](https://console.anthropic.com) 建立 API Key，貼入左側欄位（儲存於 localStorage，不會上傳）。

### 3. 部署 Cloudflare Worker（建議）

Worker 負責繞過 FDA accessdata.fda.gov 的 CORS 限制，讓前端能直接讀取 PDF 原文。

**步驟：**

1. 前往 [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create Worker
2. 將本 repo 的 `worker.js` 內容完整貼上
3. 點 Deploy，複製 Worker URL（格式：`https://fda-proxy.yourname.workers.dev`）
4. 貼入工具左側的 **Proxy URL** 欄位

> 若未設定 Worker，工具仍可運作——AI 將根據器材名稱與申請資料推斷測試項目，但準確度低於真實 PDF 解析。

---

## API 用量估算

| 模式 | 每筆 K-number 約耗用 token |
|------|--------------------------|
| 無 proxy（名稱推斷） | ~400 input + 200 output |
| 有 proxy（PDF 解析） | ~4,000 input + 300 output |

每次分析 10 筆：
- 無 proxy ≈ 0.01 USD
- 有 proxy ≈ 0.15 USD（視 PDF 頁數）

---

## 資料來源

- [openFDA Device Classification API](https://open.fda.gov/apis/device/classification/)
- [openFDA Device 510(k) API](https://open.fda.gov/apis/device/510k/)
- [FDA CDRH 510(k) Summary PDFs](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm)

---

## 檔案結構

```
fda510k/
├── index.html    # 主要單頁工具（GitHub Pages）
├── worker.js     # Cloudflare Worker proxy
└── README.md
```

---

## 注意事項

- 部分早期 510(k)（~2000 年以前）無公開 PDF Summary
- AI 解析結果僅供研究參考，不構成法規建議
- FDA API 未設定 API key 時限制 40 req/min；可至 [open.fda.gov](https://open.fda.gov/apis/authentication/) 免費申請 key 提高至 240 req/min
