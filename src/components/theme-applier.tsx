"use client";
import { useEffect } from "react";

export function ThemeApplier() {
  useEffect(() => {
    fetch("/api/preferences").then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.preferences?.theme) document.documentElement.dataset.theme = data.preferences.theme;
    }).catch(() => undefined);
  }, []);
  return null;
}
