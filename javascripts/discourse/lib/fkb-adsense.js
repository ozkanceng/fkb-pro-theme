let scriptPromise;

export function loadAdsense(publisher, doc = document) {
  if (!publisher || !/^\d+$/.test(publisher.replace(/^ca-pub-/, ""))) {
    return Promise.reject(new Error("Invalid AdSense publisher"));
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    const existing = doc.querySelector('script[src*="/pagead/js/adsbygoogle.js"]');
    if (existing && window.adsbygoogle?.loaded) {
      resolve();
      return;
    }
    const script = existing || doc.createElement("script");
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("AdSense could not load")),
      { once: true }
    );
    if (!existing) {
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-${publisher.replace(/^ca-pub-/, "")}`;
      doc.head.appendChild(script);
    }
  });
  return scriptPromise;
}

// Wait for layout, including a slot which was initially display:none. No polling.
export function waitForAdWidth(element, callback) {
  let stopped = false;
  let observer;
  let frame;
  const check = () => {
    if (
      !stopped &&
      element.isConnected &&
      element.getBoundingClientRect().width > 0 &&
      element.getClientRects().length
    ) {
      stopped = true;
      observer?.disconnect();
      callback();
    }
  };
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(check);
    observer.observe(element);
  }
  frame = requestAnimationFrame(check);
  return () => {
    stopped = true;
    observer?.disconnect();
    cancelAnimationFrame(frame);
  };
}
