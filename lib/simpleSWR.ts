import { useEffect, useState } from 'react';

type Subscriber<T> = (state: { data?: T; error?: any; isLoading: boolean }) => void;

const cache = new Map<string, any>();
const subscribers = new Map<string, Set<Subscriber<any>>>();
const fetchers = new Map<string, () => Promise<any>>();

export async function mutate<T = any>(key: string): Promise<T | undefined> {
  const f = fetchers.get(key);
  if (!f) return undefined;
  try {
    const data = await f();
    cache.set(key, data);
    const subs = subscribers.get(key);
    if (subs) {
      subs.forEach((s) => s({ data, error: undefined, isLoading: false }));
    }
    return data as T;
  } catch (err) {
    const subs = subscribers.get(key);
    if (subs) {
      subs.forEach((s) => s({ data: undefined, error: err, isLoading: false }));
    }
    throw err;
  }
}

export default function useSWR<T = any>(key: string, fetcher: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: any; isLoading: boolean }>(() => ({
    data: cache.get(key),
    error: undefined,
    isLoading: !cache.has(key),
  }));

  useEffect(() => {
    let mounted = true;

    fetchers.set(key, fetcher);

    const subs = subscribers.get(key) ?? new Set<Subscriber<T>>();
    subs.add(setState as Subscriber<T>);
    subscribers.set(key, subs);

    if (!cache.has(key)) {
      fetcher()
        .then((data) => {
          cache.set(key, data);
          if (!mounted) return;
          setState({ data, error: undefined, isLoading: false });
        })
        .catch((err) => {
          if (!mounted) return;
          setState({ data: undefined, error: err, isLoading: false });
        });
    } else {
      setState({ data: cache.get(key), error: undefined, isLoading: false });
    }

    return () => {
      mounted = false;
      const s = subscribers.get(key);
      s?.delete(setState as Subscriber<T>);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data: state.data as T | undefined, error: state.error, isLoading: state.isLoading };
}
