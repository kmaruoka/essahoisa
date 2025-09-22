import { useEffect, useMemo, useState } from 'react';
import { useScheduleData } from '../hooks/useScheduleData';
import type { AppConfig, MonitorConfig } from '../types';
import { ScheduleRow } from './ScheduleRow';
import { formatSpeech } from '../utils/formatSpeech';

interface ScheduleScreenProps {
  monitor: MonitorConfig;
  appConfig: AppConfig;
}

const toDisplayTime = (isoString?: string): string | undefined => {
  if (!isoString) return undefined;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const datePart = `${date.getFullYear()}/${`${date.getMonth() + 1}`.padStart(2, '0')}/${`${date.getDate()}`.padStart(2, '0')}`;
  const timePart = date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
};

const SPEECH_SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window;

export const ScheduleScreen = ({ monitor, appConfig }: ScheduleScreenProps) => {
  const refreshIntervalMs = useMemo(() => {
    const intervalSeconds = monitor.refreshIntervalSeconds ?? appConfig.pollingIntervalSeconds ?? 30;
    return intervalSeconds * 1000;
  }, [monitor.refreshIntervalSeconds, appConfig.pollingIntervalSeconds]);

  const { data, loading, error } = useScheduleData({
    url: monitor.dataUrl,
    refreshIntervalMs,
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const displayCountRaw = monitor.displayEntryCount ?? 1;
  const mainCount = Math.max(1, displayCountRaw);
  const mainEntries = entries.slice(0, mainCount);
  const nextEntry = entries.length > mainCount ? entries[mainCount] : undefined;

  const [lastSpokenId, setLastSpokenId] = useState<string | null>(null);

  useEffect(() => {
    setLastSpokenId(null);
  }, [monitor.id]);

  useEffect(() => {
    if (!monitor.hasAudio || !SPEECH_SUPPORTED) {
      return;
    }
    if (!mainEntries.length) {
      return;
    }
    const target = mainEntries[0];
    if (!target.id || target.id === lastSpokenId) {
      return;
    }

    const template = monitor.speechFormat ?? appConfig.speechFormat;
    const message = formatSpeech(template, target);
    if (!message.trim()) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = monitor.speechRate ?? 1;
    utterance.pitch = monitor.speechPitch ?? 1;
    utterance.lang = monitor.speechLang ?? 'ja-JP';

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setLastSpokenId(target.id);
  }, [monitor.hasAudio, monitor.speechFormat, monitor.speechRate, monitor.speechPitch, monitor.speechLang, appConfig.speechFormat, mainEntries, lastSpokenId]);

  const headerMeta: string[] = [];
  if (data?.meta?.sheetName) {
    headerMeta.push(`シート: ${data.meta.sheetName}`);
  }
  if (data?.meta?.generatedAt) {
    headerMeta.push(`最終更新: ${toDisplayTime(data.meta.generatedAt)}`);
  }
  if (monitor.sheetKey) {
    headerMeta.push(`設定キー: ${monitor.sheetKey}`);
  }

  return (
    <div className="screen">
      <header className="header">
        <div className="header-title">{monitor.title}</div>
        {monitor.headerNote && <div className="header-note">{monitor.headerNote}</div>}
        {headerMeta.length > 0 && <div className="header-meta">{headerMeta.join(' ｜ ')}</div>}
        {!SPEECH_SUPPORTED && monitor.hasAudio && (
          <div className="header-note">※ このブラウザーでは音声合成が利用できません。</div>
        )}
      </header>
      <main className="main">
        {loading && <div className="placeholder">データを読み込み中...</div>}
        {!loading && error && <div className="placeholder">{error}</div>}
        {!loading && !error && mainEntries.length === 0 && <div className="placeholder">入線予定はありません</div>}
        {!loading && !error && mainEntries.map((entry) => <ScheduleRow key={entry.id} entry={entry} variant="primary" />)}
      </main>
      <div className="divider" />
      <footer className="footer">
        <div className="footer-inner">
          <div className="next-indicator">次</div>
          {nextEntry ? (
            <ScheduleRow entry={nextEntry} variant="secondary" />
          ) : (
            <div className="placeholder">次の入線予定はありません</div>
          )}
        </div>
      </footer>
    </div>
  );
};
