/**
 * IndexedDB ストレージサービス
 * カスタムパズルの画像データを含む大容量データを保存する
 * localStorageの5MB制限を回避し、数十〜100枚以上のパズルを保存可能
 */

import { CustomPuzzle, PuzzleSummary } from '../types';

const DB_NAME = 'sagashimono_db';
const DB_VERSION = 1;
const STORE_NAME = 'custom_puzzles';

// localStorage からの移行用キー
const LS_KEY = 'sagashimono_custom_puzzles';
const MIGRATION_DONE_KEY = 'sagashimono_idb_migrated';

/**
 * IndexedDB を開く（初回はストア作成 + localStorage からの移行）
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * localStorage に残っている旧データを IndexedDB に移行する
 * 一度だけ実行される
 */
export async function migrateFromLocalStorage(): Promise<void> {
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return;

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATION_DONE_KEY, '1');
      return;
    }

    const puzzles: CustomPuzzle[] = JSON.parse(raw);
    if (puzzles.length === 0) {
      localStorage.setItem(MIGRATION_DONE_KEY, '1');
      localStorage.removeItem(LS_KEY);
      return;
    }

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const puzzle of puzzles) {
      store.put(puzzle);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();

    // 移行完了 → localStorage のパズルデータを削除して容量を開放
    localStorage.removeItem(LS_KEY);
    localStorage.setItem(MIGRATION_DONE_KEY, '1');
    console.log(`IndexedDB移行完了: ${puzzles.length}件のパズルを移行しました`);
  } catch (err) {
    console.error('IndexedDB移行エラー:', err);
    // 移行失敗でもフラグは立てない → 次回再試行
  }
}

/**
 * カスタムパズルを保存（追加 or 上書き）
 */
export async function saveCustomPuzzle(puzzle: CustomPuzzle): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(puzzle);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

/**
 * 全カスタムパズルを取得
 */
export async function getAllCustomPuzzles(): Promise<CustomPuzzle[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? []);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * 特定のカスタムパズルを取得
 */
export async function getCustomPuzzle(id: string): Promise<CustomPuzzle | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).get(id);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * カスタムパズルを削除
 */
export async function deleteCustomPuzzle(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

/**
 * カスタムパズル一覧をサマリー形式で取得
 */
export async function getCustomPuzzleSummaries(): Promise<PuzzleSummary[]> {
  const puzzles = await getAllCustomPuzzles();
  return puzzles.map(p => ({
    id: p.id,
    name: p.name,
    thumbnail: p.imageData,
    targetCount: p.targets.reduce((sum, t) => sum + t.positions.length, 0),
  }));
}
