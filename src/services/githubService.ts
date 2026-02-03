// GitHub API を使ってパズルをリポジトリにアップロードするサービス
// 注意: Personal Access Token (PAT) が必要

const REPO_OWNER = 'Kake-git-hub';
const REPO_NAME = 'SagashimonoGame';
const BRANCH = 'main';

interface GitHubUploadResult {
  success: boolean;
  message: string;
  url?: string;
}

// Base64エンコード（日本語対応）
function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

// ファイルをGitHubにアップロード
async function uploadFileToGitHub(
  token: string,
  path: string,
  content: string,
  message: string,
  isBase64 = false
): Promise<GitHubUploadResult> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  
  try {
    // まず既存ファイルのSHAを取得（更新の場合必要）
    let sha: string | undefined;
    try {
      const existingResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      if (existingResponse.ok) {
        const existingData = await existingResponse.json();
        sha = existingData.sha;
      }
    } catch {
      // ファイルが存在しない場合は無視
    }

    const body: {
      message: string;
      content: string;
      branch: string;
      sha?: string;
    } = {
      message,
      content: isBase64 ? content : utf8ToBase64(content),
      branch: BRANCH,
    };
    
    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'アップロードに失敗しました');
    }

    const data = await response.json();
    return {
      success: true,
      message: 'アップロード成功',
      url: data.content?.html_url,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'エラーが発生しました',
    };
  }
}

// Base64をUTF-8文字列としてデコード
function decodeBase64Utf8(base64: string): string {
  // 改行を除去
  const cleanBase64 = base64.replace(/\n/g, '');
  // atobはLatin-1として解釈するので、バイナリ文字列を取得
  const binaryString = atob(cleanBase64);
  // Uint8Arrayに変換
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  // TextDecoderでUTF-8としてデコード
  return new TextDecoder('utf-8').decode(bytes);
}

// index.jsonを取得
async function getIndexJson(token: string): Promise<{ id: string; name: string; thumbnail: string; targetCount: number }[]> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/public/puzzles/index.json`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('index.jsonの取得に失敗しました');
  }

  const data = await response.json();
  let content = decodeBase64Utf8(data.content);
  
  // BOM（Byte Order Mark）を除去
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  return JSON.parse(content);
}

// パズルをサーバーにアップロード
export async function uploadPuzzleToServer(
  token: string,
  puzzleData: {
    id: string;
    name: string;
    targets: { title: string; positions: { x: number; y: number; size: string }[] }[];
    imageData: string; // Base64 data URL
  }
): Promise<GitHubUploadResult> {
  const sanitizedId = puzzleData.id.replace(/[<>:"/\\|?*]/g, '_');
  
  try {
    // 1. 画像をアップロード
    const imageBase64 = puzzleData.imageData.split(',')[1];
    const imagePath = `public/puzzles/images/${sanitizedId}.webp`;
    
    const imageResult = await uploadFileToGitHub(
      token,
      imagePath,
      imageBase64,
      `Add puzzle image: ${puzzleData.name}`,
      true
    );
    
    if (!imageResult.success) {
      return imageResult;
    }

    // 2. JSONファイルをアップロード
    const puzzleJson = {
      id: sanitizedId,
      name: puzzleData.name,
      imageSrc: `puzzles/images/${sanitizedId}.webp`,
      targets: puzzleData.targets,
    };
    
    const jsonPath = `public/puzzles/${sanitizedId}.json`;
    const jsonResult = await uploadFileToGitHub(
      token,
      jsonPath,
      JSON.stringify(puzzleJson, null, 2),
      `Add puzzle data: ${puzzleData.name}`
    );
    
    if (!jsonResult.success) {
      return jsonResult;
    }

    // 3. index.jsonを更新
    const currentIndex = await getIndexJson(token);
    
    // 既存エントリを削除して新しいものを追加
    const newIndex = currentIndex.filter(p => p.id !== sanitizedId);
    newIndex.push({
      id: sanitizedId,
      name: puzzleData.name,
      thumbnail: `puzzles/images/${sanitizedId}.webp`,
      targetCount: puzzleData.targets.reduce((sum, t) => sum + t.positions.length, 0),
    });
    
    const indexResult = await uploadFileToGitHub(
      token,
      'public/puzzles/index.json',
      JSON.stringify(newIndex, null, 2),
      `Update index.json: add ${puzzleData.name}`
    );
    
    if (!indexResult.success) {
      return indexResult;
    }

    return {
      success: true,
      message: `「${puzzleData.name}」をサーバーにアップロードしました。数分後にサイトに反映されます。`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'エラーが発生しました',
    };
  }
}

// トークンの検証
export async function validateGitHubToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// GitHubからファイルを削除
async function deleteFileFromGitHub(
  token: string,
  path: string,
  message: string
): Promise<GitHubUploadResult> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;
  
  try {
    // まずファイルのSHAを取得
    const existingResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (!existingResponse.ok) {
      return {
        success: false,
        message: 'ファイルが見つかりません',
      };
    }
    
    const existingData = await existingResponse.json();
    const sha = existingData.sha;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sha,
        branch: BRANCH,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || '削除に失敗しました');
    }

    return {
      success: true,
      message: '削除成功',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'エラーが発生しました',
    };
  }
}

// サーバーからパズルを削除
export async function deleteServerPuzzle(
  token: string,
  puzzleId: string,
  puzzleName: string
): Promise<GitHubUploadResult> {
  try {
    // 1. 画像を削除
    const imagePath = `public/puzzles/images/${puzzleId}.webp`;
    await deleteFileFromGitHub(token, imagePath, `Delete puzzle image: ${puzzleName}`);

    // 2. JSONファイルを削除
    const jsonPath = `public/puzzles/${puzzleId}.json`;
    await deleteFileFromGitHub(token, jsonPath, `Delete puzzle data: ${puzzleName}`);

    // 3. index.jsonを更新
    const currentIndex = await getIndexJson(token);
    const newIndex = currentIndex.filter(p => p.id !== puzzleId);
    
    const indexResult = await uploadFileToGitHub(
      token,
      'public/puzzles/index.json',
      JSON.stringify(newIndex, null, 2),
      `Update index.json: remove ${puzzleName}`
    );
    
    if (!indexResult.success) {
      return indexResult;
    }

    return {
      success: true,
      message: `「${puzzleName}」をサーバーから削除しました。数分後にサイトに反映されます。`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'エラーが発生しました',
    };
  }
}
