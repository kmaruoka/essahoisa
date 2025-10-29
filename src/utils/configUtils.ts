// 設定ファイルURL構築関数
export const buildConfigUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'config/app-config.json';
  }
  const base = window.location.href.split(/[?#]/)[0];
  const lastSlash = base.lastIndexOf('/');
  const lastSegment = lastSlash >= 0 ? base.slice(lastSlash + 1) : base;
  const hasExtension = lastSegment.includes('.');
  const normalized = hasExtension
    ? base.slice(0, lastSlash + 1)
    : base.endsWith('/') ? base : base + '/';

  return `${normalized}config/app-config.json`;
};
