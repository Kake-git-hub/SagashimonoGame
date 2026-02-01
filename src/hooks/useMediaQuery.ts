import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // 初期値を設定
    setMatches(mediaQuery.matches);

    // リスナーを追加
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

// よく使うブレークポイント用のフック
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

export function useIsLandscape(): boolean {
  return useMediaQuery('(orientation: landscape)');
}
