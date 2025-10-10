import { useEffect, useMemo, useState } from 'react';
import { useScheduleData } from '../hooks/useScheduleData';
import type { AppConfig, MonitorConfig } from '../types';
import { ScheduleRow } from './ScheduleRow';
import { formatSpeech } from '../utils/formatSpeech';
import { Container, Row, Col } from 'react-bootstrap';

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

// MP3ファイル再生機能
const playMp3File = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio(filePath);
    audio.onended = () => resolve();
    audio.onerror = (error) => reject(error);
    audio.play().catch(reject);
  });
};

// 音声再生前後のMP3ファイル再生
const playBroadcastingStart = async (): Promise<void> => {
  try {
    await playMp3File('/data/broadcasting-start1.mp3');
    console.log('放送開始音声再生完了');
  } catch (error) {
    console.error('放送開始音声再生エラー:', error);
  }
};

const playBroadcastingEnd = async (): Promise<void> => {
  try {
    await playMp3File('/data/broadcasting-end1.mp3');
    console.log('放送終了音声再生完了');
  } catch (error) {
    console.error('放送終了音声再生エラー:', error);
  }
};

// デバッグ用：音声合成APIの状態確認
const checkSpeechSynthesis = () => {
  if (typeof window === 'undefined') return;
  
  console.log('音声合成API状態:', {
    speechSynthesis: !!window.speechSynthesis,
    voices: window.speechSynthesis?.getVoices?.()?.length || 0,
    speaking: window.speechSynthesis?.speaking || false,
    pending: window.speechSynthesis?.pending || false
  });
};

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
  
  // 現在時刻を基準に直近未来時刻のデータを取得（日をまたぐ対応）
  const filteredEntries = useMemo(() => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // 分単位で現在時刻を取得
    
    return entries.filter(entry => {
      if (!entry.arrivalTime) return false;
      
      // 到着時刻を分単位に変換
      const [hours, minutes] = entry.arrivalTime.split(':').map(Number);
      const arrivalTime = hours * 60 + minutes;
      
      // 現在時刻以降のデータを取得
      // ただし、深夜（23時以降）の場合は翌日の早朝（6時前）も含める
      if (currentTime >= 1380) { // 23:00以降
        return arrivalTime >= currentTime || arrivalTime < 360; // 6時前も含める
      } else {
        return arrivalTime >= currentTime; // 通常は現在時刻以降のみ
      }
    });
  }, [entries]);
  
  const displayCountRaw = monitor.displayEntryCount ?? 1;
  const mainCount = Math.max(1, displayCountRaw);
  const mainEntries = filteredEntries.slice(0, mainCount);
  const nextEntry = filteredEntries.length > mainCount ? filteredEntries[mainCount] : undefined;

  const [spokenEntries, setSpokenEntries] = useState<Set<string>>(new Set());
  const [userInteracted, setUserInteracted] = useState(false);

  useEffect(() => {
    setSpokenEntries(new Set());
    setUserInteracted(false);
  }, [monitor.id]);

  // ユーザーインタラクション検知と自動有効化の試行
  useEffect(() => {
    const handleUserInteraction = () => {
      setUserInteracted(true);
    };

    // 自動有効化の試行（ブラウザによっては動作する場合がある）
    const tryAutoEnable = () => {
      if (monitor.hasAudio && SPEECH_SUPPORTED) {
        // 無音の音声を再生してAPIを有効化
        const silentUtterance = new SpeechSynthesisUtterance('');
        silentUtterance.volume = 0;
        silentUtterance.onstart = () => {
          console.log('音声API自動有効化成功');
          setUserInteracted(true);
        };
        silentUtterance.onerror = () => {
          console.log('音声API自動有効化失敗 - ユーザーインタラクションが必要');
        };
        
        try {
          window.speechSynthesis.speak(silentUtterance);
        } catch (e) {
          console.log('音声API自動有効化エラー:', e);
        }
      }
    };

    // ページロード後少し遅延してから自動有効化を試行
    const timer = setTimeout(tryAutoEnable, 1000);

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [monitor.hasAudio, SPEECH_SUPPORTED]);

  // デバッグ用：リロード時に上段データの音声再生
  useEffect(() => {
    checkSpeechSynthesis();
    
    console.log('デバッグ音声再生チェック:', {
      hasAudio: monitor.hasAudio,
      SPEECH_SUPPORTED,
      userInteracted,
      mainEntriesLength: mainEntries.length,
      mainEntries: mainEntries
    });

    if (!monitor.hasAudio || !SPEECH_SUPPORTED || !userInteracted) {
      console.log('音声再生スキップ:', { 
        hasAudio: monitor.hasAudio, 
        SPEECH_SUPPORTED, 
        userInteracted 
      });
      return;
    }
    if (!mainEntries.length) {
      console.log('メインエントリなし');
      return;
    }

    const target = mainEntries[0];
    if (!target.id) {
      console.log('ターゲットIDなし:', target);
      return;
    }

    // デバッグ用：リロード時に即座に音声再生
    const template = monitor.speechFormat ?? appConfig.speechFormat;
    const message = formatSpeech(template, target);
    console.log('音声メッセージ:', { template, message, target });
    
    if (!message.trim()) {
      console.log('メッセージが空');
      return;
    }

    // 音声再生の前後にMP3ファイルを再生
    const playSpeechWithBroadcasting = async () => {
      // 放送開始音声を再生
      await playBroadcastingStart();
      
      // 音声合成のイベントリスナーを追加
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = monitor.speechRate ?? 1;
      utterance.pitch = monitor.speechPitch ?? 1;
      utterance.lang = monitor.speechLang ?? 'ja-JP';

      utterance.onstart = () => console.log('音声再生開始');
      utterance.onend = async () => {
        console.log('音声再生終了');
        // 放送終了音声を再生
        await playBroadcastingEnd();
      };
      utterance.onerror = (event) => console.error('音声再生エラー:', event);

      console.log('音声再生開始:', { message, rate: utterance.rate, pitch: utterance.pitch, lang: utterance.lang });
      
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };

    // 少し遅延させてから再生（ブラウザの制限回避）
    setTimeout(playSpeechWithBroadcasting, 100);
  }, [monitor.hasAudio, monitor.speechFormat, monitor.speechRate, monitor.speechPitch, monitor.speechLang, appConfig.speechFormat, mainEntries, userInteracted]);

  // 音声案内のタイミングチェック
  useEffect(() => {
    if (!monitor.hasAudio || !SPEECH_SUPPORTED) {
      return;
    }
    if (!filteredEntries.length) {
      return;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const speechTimings = monitor.speechTimings ?? [0]; // デフォルトは入線時刻

    filteredEntries.forEach(entry => {
      if (!entry.id || !entry.arrivalTime) return;

      // 到着時刻を分単位に変換
      const [hours, minutes] = entry.arrivalTime.split(':').map(Number);
      const arrivalTime = hours * 60 + minutes;

      speechTimings.forEach(timingMinutes => {
        const speechTime = arrivalTime - timingMinutes;
        const speechKey = `${entry.id}-${timingMinutes}`;
        
        // 音声案内のタイミングが来たかチェック
        if (currentTime >= speechTime && currentTime < speechTime + 1 && !spokenEntries.has(speechKey)) {
          const template = monitor.speechFormat ?? appConfig.speechFormat;
          const message = formatSpeech(template, entry);
          if (!message.trim()) {
            return;
          }

          // 音声再生の前後にMP3ファイルを再生
          const playSpeechWithBroadcasting = async () => {
            // 放送開始音声を再生
            await playBroadcastingStart();
            
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.rate = monitor.speechRate ?? 1;
            utterance.pitch = monitor.speechPitch ?? 1;
            utterance.lang = monitor.speechLang ?? 'ja-JP';

            utterance.onstart = () => console.log('音声再生開始');
            utterance.onend = async () => {
              console.log('音声再生終了');
              // 放送終了音声を再生
              await playBroadcastingEnd();
            };
            utterance.onerror = (event) => console.error('音声再生エラー:', event);

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
          };

          playSpeechWithBroadcasting();
          setSpokenEntries(prev => new Set([...prev, speechKey]));
        }
      });
    });
  }, [monitor.hasAudio, monitor.speechFormat, monitor.speechRate, monitor.speechPitch, monitor.speechLang, monitor.speechTimings, appConfig.speechFormat, filteredEntries, spokenEntries]);

  return (
    <Container fluid className="screen">
      <Row className="header">
        <Col className="header-title">{monitor.title}</Col>
        {!SPEECH_SUPPORTED && monitor.hasAudio && (
          <Col className="header-note">※ このブラウザーでは音声合成が利用できません。</Col>
        )}
        {SPEECH_SUPPORTED && monitor.hasAudio && !userInteracted && (
          <Col className="header-note">
            ※ 音声案内を有効にするには、ページをクリックしてください。
            <button 
              className="btn btn-sm btn-primary ms-2" 
              onClick={() => setUserInteracted(true)}
              style={{ fontSize: '0.8em' }}
            >
              音声を有効にする
            </button>
          </Col>
        )}
      </Row>
      <Row className="main align-items-center" style={{ minHeight: '50vh' }}>
        <Col>
          {loading && <div className="placeholder">データを読み込み中...</div>}
          {!loading && error && <div className="placeholder">{error}</div>}
          {!loading && !error && mainEntries.length === 0 && <div className="placeholder">データがありません</div>}
          {!loading && !error && mainEntries.map((entry) => <ScheduleRow key={entry.id} entry={entry} variant="primary" />)}
        </Col>
      </Row>
      <Row className="divider" style={{ flexShrink: 0 }} />
      <Row className="footer align-items-center" style={{ minHeight: '30vh' }}>
        <Col>
          <Row className="footer-inner">
            <Col xs="auto" className="next-indicator">次</Col>
            <Col>
              {nextEntry ? (
                <ScheduleRow entry={nextEntry} variant="secondary" />
              ) : (
                <div className="placeholder">次の入線予定はありません</div>
              )}
            </Col>
          </Row>
        </Col>
      </Row>
    </Container>
  );
};
