"use client";

import { useEffect } from "react";

// Toggles a body-level class for the duration this is mounted. Scoped via
// --radius (see globals.css) so it reaches everything deriving a rounded-*
// utility from it, including dialog content — Base UI portals that to
// <body>, outside this component's own React tree, so the class has to live
// on a shared ancestor rather than a wrapper div here.
export function SquareCorners() {
  useEffect(() => {
    document.body.classList.add("square-corners");
    return () => {
      document.body.classList.remove("square-corners");
    };
  }, []);

  return null;
}
