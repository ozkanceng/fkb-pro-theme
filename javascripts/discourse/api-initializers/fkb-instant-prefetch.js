import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", () => {
  const prefetched = new Set();

  function prefetchLink(target) {
    const link = target.closest("a.main-link, a.topic-link, .topic-list-item a");
    if (!link || !link.href) {
      return;
    }
    const url = link.href;
    if (prefetched.has(url) || !url.startsWith(window.location.origin)) {
      return;
    }
    
    prefetched.add(url);
    const prefetchTag = document.createElement("link");
    prefetchTag.rel = "prefetch";
    prefetchTag.href = url;
    prefetchTag.as = "document";
    document.head.appendChild(prefetchTag);
  }

  document.addEventListener(
    "pointerenter",
    (e) => {
      if (e.target && e.target.closest) {
        prefetchLink(e.target);
      }
    },
    { passive: true, capture: true }
  );

  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.target && e.target.closest) {
        prefetchLink(e.target);
      }
    },
    { passive: true, capture: true }
  );
});
