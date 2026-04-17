import { useEffect, useState } from "react";
import {
  fetchPublicLaunchStatus,
  type PublicLaunchStatus,
} from "@/lib/publicLaunchStatus";

type LaunchStatusState = {
  data: PublicLaunchStatus | null;
  loading: boolean;
  error: string | null;
};

export function usePublicLaunchStatus() {
  const [state, setState] = useState<LaunchStatusState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    void fetchPublicLaunchStatus()
      .then((data) => {
        if (cancelled) {
          return;
        }
        setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load launch cities",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
