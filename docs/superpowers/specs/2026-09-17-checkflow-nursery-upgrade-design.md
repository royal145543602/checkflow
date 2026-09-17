# CheckFlow — 托兒所/補習社簽到功能升級設計

- **日期**：2026-09-17
- **狀態**：設計稿
- **相關文件**：`src/lib/types.ts`, `src/lib/db.ts`, `src/app/page.tsx`, `src/app/view/[teamId]/page.tsx`, `src/components/Sidebar.tsx`

## 1. 概述

在 CheckFlow 既有架構上擴展三個功能，面向托兒所 / 補習社 / 托管班的日常簽到場景。沿用現有技術棧（Next.js App Router + Supabase + GSAP），不改路由結構、不新增框架。

三個功能按依賴關係依次開發：**學生資料卡 (D) → 家長查詢頁 (B) → 出勤報表 (C)**

---

## 2. 資料庫變更

### members 表新增欄位

```sql
-- Supabase SQL Editor 執行一次
ALTER TABLE members ADD COLUMN phone TEXT;
ALTER TABLE members ADD COLUMN notes TEXT;
```

- `phone`：家長電話號碼，僅管理員可查看完整號碼
- `notes`：備註（過敏、接送人、注意事項等），僅管理員可查看
- 不影響現有 records 表的結構

### local checkin.db

本機開發用的 SQLite 也需同步。使用 `npm run migrate` 或在啟動時自動檢查 schema。

---

## 3. 功能 D：學生資料卡

### 3.1 類型擴充

`src/lib/types.ts` 中 `Member` 增加：

```ts
export interface Member {
  id: string;
  teamId: string;
  name: string;
  isPreset: boolean;
  phone?: string;
  notes?: string;
}
```

### 3.2 Sidebar 編輯入口

在 `Sidebar.tsx` 成員清單中：

- 現有：成員名稱旁的「刪除」按鈕
- 新增：每個成員右側加一個「編輯資料」圖標（🔍/鉛筆圖標），點開彈出 `AnimatedModal`
- Modal 內容：兩個輸入框（電話、備註） + 儲存/取消按鈕
- 輸入框樣式沿用 `input-pt` class

### 3.3 API 變更

| 路由 | 方法 | 變更 |
|---|---|---|
| `/api/members/[id]` | PATCH | 接受 `{ phone, notes }`，更新對應欄位 |
| `/api/members/[id]` | GET | 返回完整 Member 含 phone / notes（管理員用） |
| `/api/members/[id]/records` | GET | 不變 |
| `/api/teams/[id]/status` | GET | `MemberStatus` 不曝露 phone / notes（給 view 頁用） |

### 3.4 隱私控制

- 管理員頁面（`/`，admin 視角）的 API：返回完整電話
- View 頁（`/view/[teamId]`）的 API：phone 欄位脫敏，只留尾 4 位 `****1234`
- 家長頁（下面 `/parent/[teamId]`）的 API：不返回 phone

### 3.5 i18n 補充

新增字串：

| key | en | zh |
|---|---|---|
| `editMember` | "Edit" | "編輯資料" |
| `phone` | "Phone" | "家長電話" |
| `notes` | "Notes" | "備註" |
| `phoneMasked` | "only admin can view" | "僅管理員可見" |
| `save` | "Save" | "儲存" (已存在, 復用) |

---

## 4. 功能 B：家長查詢頁

### 4.1 新路由

```
/parent/[teamId]/page.tsx
```

### 4.2 流程

1. 用戶打開 `/parent/{teamId}` → 看到一個輸入框「請輸入家長電話號碼」
2. 輸入完整電話 → 點查詢 → 後端比對 phone 欄位（精準匹配）
3. 找到該學生 → 顯示：

```
學生姓名：XXX
今日狀態：在場 (09:00 已簽到)
        已於 17:30 簽退

最近 7 天記錄：
  09/17 09:00 簽到  17:30 簽退  ✓
  09/16 08:50 簽到  17:20 簽退  ✓
  09/15 — (無記錄)
```

4. 若電話號碼不存在 → 提示「未找到相關記錄」

### 4.3 視覺風格

- 沿用現有深色主題（`var(--bg)`, `var(--green)`）
- 簡潔卡片佈局，不用頂部導航欄
- 頁面頂部顯示機構名稱（由 teamId 獲取 team name）
- 無 GSAP 動畫（純功能頁）

### 4.4 API 新增

| 路由 | 方法 | 說明 |
|---|---|---|
| `/api/teams/[id]/parent/lookup` | POST | body `{ phone: "12345678" }` → 返回匹配的家長/學生資料與今日狀態 |

Response 格式：

```ts
{
  found: true;
  child: {
    name: string;
    status: "in" | "out" | "none";
    lastCheckIn: string | null;
    lastCheckOut: string | null;
    recentRecords: Array<{
      date: string;
      checkIn: string | null;
      checkOut: string | null;
    }>;
  };
}
```

查無結果時：

```ts
{ found: false, message: "未找到相關記錄" }
```

### 4.5 隱私

- POST body 中的電話號碼僅用於單次查詢匹配，不做持久化
- 返回資料不含電話號碼
- 無需登入 / session（tokenless — 這是個查詢工具，不是登入系統）
- 暴力猜測保護：單 IP 每分鐘最多 20 次查詢（透過 middleware 或 API route 內限流）

### 4.6 i18n 補充

| key | en | zh |
|---|---|---|
| `parentLookupTitle` | "Enter your phone number to check your child's status" | "請輸入電話查詢子女狀態" |
| `phonePlaceholder` | "Phone number" | "家長電話號碼" |
| `search` | "Search" | "查詢" |
| `parentNotFound` | "No record found for this phone number" | "未找到相關記錄" |
| `todayStatus` | "Today's Status" | "今日狀態" |
| `recentDays` | "Recent 7 Days" | "近 7 天記錄" |
| `noRecord` | "No record" | "無記錄" |
| `childName` | "Child Name" | "學生姓名" |

---

## 5. 功能 C：出勤報表

### 5.1 入口

- Sidebar 新增「報表」按鈕
- 點擊後彈出 AnimatedModal 或切換到新 tab（與現有 Sidebar 交互模式一致）

### 5.2 報表頁面內容

- **日期範圍選擇**：沿用現有 `dateFrom` / `dateTo` 日曆輸入模式
- **團隊選擇**：已經可選 team
- **表格顯示**：

| 姓名 | 應到天數 | 實到天數 | 出勤率 | 簽到記錄 |
|---|---|---|---|---|
| 張小明 | 5 | 5 | 100% | 09:00↘17:30, 08:50↘17:20... |
| 李小花 | 5 | 3 | 60%  | 09:10↘17:00(缺 2 天) |

- 簽到記錄預設顯示簡寫，可點展開查看每天詳情

### 5.3 視覺風格

- 表格樣式沿用現有 `.view-member` card 佈局
- 出勤率低於 80% 的數字以橙色/紅色標示
- 響應式：大螢幕表格展示，小螢幕卡片列表

### 5.4 API 新增

| 路由 | 方法 | 說明 |
|---|---|---|
| `/api/teams/[id]/report?from=...&to=...` | GET | 返回指定日期範圍內所有成員的出勤彙總 |

Response 格式：

```ts
{
  teamName: string;
  from: string;
  to: string;
  members: Array<{
    name: string;
    total: number;          // 應到天數
    present: number;        // 實到天數
    rate: number;           // 出勤率 0-1
    days: Array<{
      date: string;
      checkIn: string | null;
      checkOut: string | null;
    }>;
  }>;
}
```

- 「應到天數」在有記錄的日期範圍內，扣除星期六日（週末）
- 一天內至少有一次簽到即算「實到」
- 可選參數 `includeWeekends=false`（預設不納入週末）

### 5.5 i18n 補充

| key | en | zh |
|---|---|---|
| `report` | "Report" | "出勤報表" |
| `attendanceRate` | "Attendance Rate" | "出勤率" |
| `expectedDays` | "Expected" | "應到天數" |
| `actualDays` | "Actual" | "實到天數" |
| `detail` | "Detail" | "詳情" |
| `day` | "day" | "天" |
| `days` | "days" | "天" |

---

## 6. API 總變更總結

| 路由 | 動作 | 用途 |
|---|---|---|
| `PATCH /api/members/[id]` | 新增 | 更新 phone / notes |
| `POST /api/teams/[id]/parent/lookup` | 新增 | 家長查詢 |
| `GET /api/teams/[id]/report` | 新增 | 出勤報表 |

無需新增資料庫表，僅擴充 members 表。

---

## 7. 開發順序與依賴

```
D (學生資料卡) ──→ B (家長查詢頁) ──→ C (出勤報表)
     │                    │
     └── phone 欄位基礎    └── 復用 records 查詢邏輯
```

1. **D**：擴充 members 表 + 型別 + API PATCH + Sidebar UI → 最優先，因為 B 依賴 phone 資料
2. **B**：新頁面 `/parent/[teamId]` + lookup API → 第二
3. **C**：新 API `/report` + 報表 UI → 最後（獨立的彙總查詢，無依賴）

---

## 8. 未涵蓋（此版本不做）

- 家長帳號 / 登入系統
- 微信小程序（先 H5，日後用 Taro 編譯）
- 短信 / 推送通知（待接入通知通道後再議）
- 圖片 / 大頭照上傳（需要雲端存儲方案）
- 多次出入記錄的圖形化展示