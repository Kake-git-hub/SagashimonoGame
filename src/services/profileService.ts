/**
 * プロフィール（だれが遊んでいるか・なんさいか）
 * - 端末ごとに localStorage に保存する（キー: asobi_profiles）
 * - 兄弟で分けられるよう複数のプロフィールを持てる。進捗はプロフィールごとに分かれる
 * - 最初に作ったプロフィールは、それまでのセーブデータ（sagashimono_progress / neji_progress）を
 *   そのまま引き継ぐ（キーを変えない）。2 人目以降は "__<id>" を付けたキーに保存する
 */

export interface Profile {
  id: string;
  name: string;
  age: number;        // 3〜12
  avatar: string;     // 絵文字
  createdAt: number;
}

interface ProfileStore {
  profiles: Profile[];
  currentId: string | null;
  legacyOwnerId: string | null; // 接頭辞なしの既存キーを使うプロフィール
}

const STORE_KEY = 'asobi_profiles';

export const MIN_AGE = 3;
export const MAX_AGE = 12;
export const AVATARS = ['🐻', '🐰', '🐱', '🐶', '🦊', '🐼', '🐸', '🦁', '🐧', '🦄'];

function readStore(): ProfileStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProfileStore>;
      return {
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        currentId: parsed.currentId ?? null,
        legacyOwnerId: parsed.legacyOwnerId ?? null,
      };
    }
  } catch {
    // 壊れていたら作り直す
  }
  return { profiles: [], currentId: null, legacyOwnerId: null };
}

function writeStore(store: ProfileStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function getProfiles(): Profile[] {
  return readStore().profiles;
}

export function getCurrentProfile(): Profile | null {
  const store = readStore();
  return store.profiles.find(p => p.id === store.currentId) ?? null;
}

export function setCurrentProfile(id: string): void {
  const store = readStore();
  if (!store.profiles.some(p => p.id === id)) return;
  store.currentId = id;
  writeStore(store);
}

export function clampAge(age: number): number {
  if (!Number.isFinite(age)) return 6;
  return Math.max(MIN_AGE, Math.min(MAX_AGE, Math.round(age)));
}

export function createProfile(input: { name: string; age: number; avatar?: string }): Profile {
  const store = readStore();
  const profile: Profile = {
    id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim() || 'わたし',
    age: clampAge(input.age),
    avatar: input.avatar ?? AVATARS[store.profiles.length % AVATARS.length],
    createdAt: Date.now(),
  };
  store.profiles.push(profile);
  // 最初のプロフィールは既存のセーブデータを引き継ぐ
  if (store.legacyOwnerId === null) store.legacyOwnerId = profile.id;
  store.currentId = profile.id;
  writeStore(store);
  return profile;
}

export function updateProfile(id: string, patch: Partial<Pick<Profile, 'name' | 'age' | 'avatar'>>): void {
  const store = readStore();
  const profile = store.profiles.find(p => p.id === id);
  if (!profile) return;
  if (patch.name !== undefined) profile.name = patch.name.trim() || profile.name;
  if (patch.age !== undefined) profile.age = clampAge(patch.age);
  if (patch.avatar !== undefined) profile.avatar = patch.avatar;
  writeStore(store);
}

// プロフィールを削除する（そのプロフィール専用のセーブデータも消す）
export function deleteProfile(id: string): void {
  const store = readStore();
  const index = store.profiles.findIndex(p => p.id === id);
  if (index < 0) return;
  store.profiles.splice(index, 1);
  if (store.legacyOwnerId !== id) {
    const suffix = `__${id}`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.endsWith(suffix)) localStorage.removeItem(key);
    }
  }
  if (store.currentId === id) store.currentId = store.profiles[0]?.id ?? null;
  writeStore(store);
}

/**
 * プロフィールごとのセーブデータ用キー
 * 最初のプロフィール（既存ユーザー）は接頭辞なしの従来キーをそのまま使う
 */
export function profileStorageKey(baseKey: string): string {
  const store = readStore();
  if (!store.currentId || store.currentId === store.legacyOwnerId) return baseKey;
  return `${baseKey}__${store.currentId}`;
}

// === 年齢 → 難易度 ===

export interface AgeDifficulty {
  quizLevel: 1 | 2 | 3 | 4 | 5;  // クイズのレベル
  nejiExtraBuffer: number;       // ネジはずしのおきばを増やす数
  nejiExtraBoxes: number;        // ネジはずしの同時に見えるボックスを増やす数
  label: string;
}

export function quizLevelForAge(age: number): AgeDifficulty['quizLevel'] {
  if (age <= 4) return 1;
  if (age <= 6) return 2;
  if (age <= 8) return 3;
  if (age <= 10) return 4;
  return 5;
}

export function difficultyForAge(age: number): AgeDifficulty {
  const a = clampAge(age);
  const quizLevel = quizLevelForAge(a);
  if (a <= 4) return { quizLevel, nejiExtraBuffer: 3, nejiExtraBoxes: 1, label: 'やさしい' };
  if (a <= 6) return { quizLevel, nejiExtraBuffer: 1, nejiExtraBoxes: 0, label: 'ふつう' };
  return { quizLevel, nejiExtraBuffer: 0, nejiExtraBoxes: 0, label: 'むずかしい' };
}
