// 載入需要用到的模組
const express = require('express');       // Express 是一個建立 API 伺服器的框架
const path = require('path');             // path 模組用來處理檔案路徑
const sqlite3 = require('sqlite3').verbose(); // SQLite 是輕量型資料庫

const app = express();       // 建立一個 Express 應用程式
const port = 3000;           // 設定伺服器監聽的埠號為 3000

app.use(express.json());

// 設定資料庫檔案路徑，這個資料庫會放在目前資料夾中
const dbPath = path.join(__dirname, 'test_user.db');
const db = new sqlite3.Database(dbPath); // 建立連線（沒有的話會自動建立）

// 當伺服器啟動時，建立資料表 electricity（如果還沒存在）
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS electricity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,   -- 自動編號的主鍵
    start REAL,                             -- 起始度數（浮點數）
    end REAL,                               -- 當月度數（浮點數）
    rate REAL,                              -- 每度電價
    usage REAL,                             -- 使用度數（end - start）
    amount REAL,                            -- 總金額（usage * rate）
    record_month TEXT,                      -- 所屬月份（yyyy-mm）
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP  -- 建立時間（預設為現在）
  )`);
});

// 回傳前端 HTML 頁面（通常放在 views/user.html）
app.get('/user', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'user.html'));
});

// 查詢所有電費紀錄（按照建立時間從新到舊排序）
app.get('/users', (req, res) => {
  db.all('SELECT * FROM electricity ORDER BY timestamp DESC', (err, rows) => {
    if (err) {
      console.error('查詢錯誤:', err);
      res.status(500).json({ error: '伺服器查詢失敗' });
    } else {
      res.json({ users: rows }); // 回傳所有資料給前端
    }
  });
});

// 新增一筆電費紀錄
app.post('/addUser', (req, res) => {
  const { start, end, rate, record_month } = req.body; // 從前端取得欄位
  const usage = end - start;           // 使用度數
  const amount = usage * rate;         // 計算金額

  const query = `INSERT INTO electricity 
    (start, end, rate, usage, amount, record_month) 
    VALUES (?, ?, ?, ?, ?, ?)`;

  const values = [start, end, rate, usage, amount, record_month]; // 準備要寫入資料庫的值

  db.run(query, values, function (err) {
    if (err) {
      console.error('新增資料失敗:', err); // 如果有錯誤，印出錯誤訊息
      res.status(500).json({ success: false, message: '新增失敗' }); // 回傳失敗訊息給前端
    } else {
      res.json({ success: true, id: this.lastID }); // 新增成功，回傳成功訊息和這筆資料的 id
    }
  });
});

// 刪除資料表中最後一筆資料（id 最大的那筆）
app.delete('/deleteLast', (req, res) => {
  const query = 'DELETE FROM electricity WHERE id = (SELECT MAX(id) FROM electricity)'; // SQL 指令：刪除 id 最大的那筆資料
  db.run(query, function (err) {
    if (err) {
      console.error('刪除失敗:', err); // 如果有錯誤，印出錯誤訊息
      res.status(500).json({ success: false }); // 回傳失敗訊息給前端
    } else {
      res.json({ success: true }); // 刪除成功，回傳成功訊息
    }
  });
});

// 查詢特定月份的資料（例如 record_month = 2024-08）
app.get('/search', (req, res) => {
  const month = req.query.month; // 從網址上拿到查詢參數（例如 /search?month=2024-08）
  if (!month) {
    return res.status(400).json({ error: '缺少月份參數' }); // 如果沒帶月份參數，回傳錯誤
  }

  const query = `SELECT * FROM electricity WHERE record_month = ? ORDER BY timestamp DESC`; // SQL 指令：查詢指定月份的所有資料，依建立時間新到舊排序
  db.all(query, [month], (err, rows) => {
    if (err) {
      console.error('查詢月份錯誤:', err); // 查詢失敗時印出錯誤
      res.status(500).json({ error: '查詢失敗' }); // 回傳查詢失敗訊息
    } else {
      res.json({ results: rows }); // 查詢成功，回傳符合該月份的所有資料
    }
  });
});

// 當伺服器被關閉時，自動關閉資料庫連線
process.on('exit', () => {
  db.close();
  console.log('資料庫已關閉');
});


app.listen(port, () => {
  console.log(`✅ 伺服器已啟動：http://localhost:${port}`);
});
