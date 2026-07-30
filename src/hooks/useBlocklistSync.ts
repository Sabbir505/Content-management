"use client";

import { useState, useEffect } from "react";

export function useBlocklistSync(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    function handleBlocklistUpdate() {
      setVersion((v) => v + 1);
    }
    window.addEventListener("tubeforge-blocklist-updated", handleBlocklistUpdate);
    return () => window.removeEventListener("tubeforge-blocklist-updated", handleBlocklistUpdate);
  }, []);

  return version;
}
