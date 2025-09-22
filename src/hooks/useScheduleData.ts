import { useEffect, useState } from 'react';
import type { ScheduleFile } from '../types';

interface UseScheduleDataOptions {
  url: string;
  refreshIntervalMs: number;
}

interface ScheduleDataState {
  data: ScheduleFile | null;
  loading: boolean;
  error: string | null;
}

export const useScheduleData = ({ url, refreshIntervalMs }: UseScheduleDataOptions): ScheduleDataState => {
  const [data, setData] = useState<ScheduleFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    const fetchData = () => {
      fetch(url, { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`データの取得に失敗しました (${response.status})`);
          }
          return (await response.json()) as ScheduleFile;
        })
        .then((json) => {
          if (!mounted) return;
          setData(json);
          setError(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (!mounted) return;
          setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
          setLoading(false);
        });
    };

    fetchData();
    timer = window.setInterval(fetchData, refreshIntervalMs);

    return () => {
      mounted = false;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [url, refreshIntervalMs]);

  return { data, loading, error };
};
