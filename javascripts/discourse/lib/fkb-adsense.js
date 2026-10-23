let scriptPromise;
let readyToLoad = false;
let readyPromise;

function waitForPageSettle(doc = document) {
  if (doc !== document || readyToLoad) {
    readyToLoad = true;
    return Promise.resolve();
  }
  if (readyPromise) {
    return readyPromise;
  }

  readyPromise = new Promise((resolve) => {
    const events = ["scroll", "touchstart", "pointerdown", "mousemove", "keydown", "click"];
    let timer;
    let idleId;

    const done = () => {
      if (readyToLoad) {
        return;
      }
      readyToLoad = true;
      events.forEach((evt) => window.removeEventListener(evt, done, { passive: true }));
      if (timer) {
        clearTimeout(timer);
      }
      if (idleId && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
      }
      resolve();
    };

    events.forEach((evt) => window.addEventListener(evt, done, { passive: true, once: true }));

    const scheduleIdle = () => {
      timer = setTimeout(() => {
        if (typeof requestIdleCallback === "function") {
          idleId = requestIdleCallback(done, { timeout: 1500 });
        } else {
          done();
        }
      }, 2800);
    };

    if (doc.readyState === "complete") {
      scheduleIdle();
    } else {
      window.addEventListener("load", scheduleIdle, { once: true, passive: true });
    }
  });

  return readyPromise;
}

export function loadAdsense(publisher, doc = document) {
  if (!publisher || !/^\d+$/.test(publisher.replace(/^ca-pub-/, ""))) {
    return Promise.reject(new Error("Invalid AdSense publisher"));
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = waitForPageSettle(doc).then(
    () =>
      new Promise((resolve, reject) => {
        const existing = doc.querySelector('script[src*="/pagead/js/adsbygoogle.js"]');
        if (existing && window.adsbygoogle?.loaded) {
          resolve();
          return;
        }
        const script = existing || doc.createElement("script");
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener(
          "error",
          () => reject(new Error("AdSense could not load")),
          { once: true }
        );
        if (!existing) {
          script.async = true;
          script.crossOrigin = "anonymous";
          script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-${publisher.replace(/^ca-pub-/, "")}`;
          (doc.head || doc.documentElement).appendChild(script);
        }
      })
  );
  return scriptPromise;
}

// Wait for stable layout with sufficient width (>= minWidth, defaults to 120px to prevent width=0 and width=52 errors).
// Uses ResizeObserver contentRect first to avoid forced synchronous reflows.
export function waitForAdWidth(element, minWidth, callback) {
  if (typeof minWidth === "function") {
    callback = minWidth;
    minWidth = 120;
  } else if (typeof minWidth !== "number" || minWidth <= 0) {
    minWidth = 120;
  }

  let stopped = false;
  let observer;
  let frame;

  const finish = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    observer?.disconnect();
    callback();
  };

  const target = element.closest?.(".google-adsense") || element.parentElement || element;

  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver((entries) => {
      if (stopped || !element.isConnected) {
        return;
      }
      for (const entry of entries) {
        const width = entry.contentRect ? entry.contentRect.width : 0;
        if (width >= minWidth) {
          finish();
          return;
        }
      }
    });
    observer.observe(target);
    if (target !== element) {
      observer.observe(element);
    }
  } else {
    const check = () => {
      if (
        !stopped &&
        element.isConnected &&
        element.getBoundingClientRect().width >= minWidth &&
        element.getClientRects().length > 0
      ) {
        finish();
      }
    };
    frame = requestAnimationFrame(check);
  }

  return () => {
    stopped = true;
    observer?.disconnect();
    if (frame) {
      cancelAnimationFrame(frame);
    }
  };
}

// Safely push an ad slot to window.adsbygoogle by ensuring no narrower (<120px) uninitialized
// <ins class="adsbygoogle"> precedes it in DOM order, preventing availableWidth=0 and availableWidth=52 TagErrors.
export function safePushAd(targetIns, minWidth = 120) {
  if (!targetIns || !targetIns.isConnected || targetIns.hasAttribute("data-adsbygoogle-status")) {
    return false;
  }

  const allPending = Array.from(
    document.querySelectorAll("ins.adsbygoogle:not([data-adsbygoogle-status])")
  );

  let readyCount = 0;
  const temporarilyHidden = [];

  for (const ins of allPending) {
    const container = ins.closest(".google-adsense") || ins.parentElement || ins;
    const width = Math.max(
      ins.offsetWidth || 0,
      container?.offsetWidth || 0
    );

    if (width < minWidth) {
      if (ins.style.display !== "none") {
        temporarilyHidden.push({ ins, prevDisplay: ins.style.display });
        ins.style.setProperty("display", "none", "important");
      }
    } else {
      ins.style.setProperty("display", "block", "important");
      readyCount++;
    }
  }

  if (readyCount === 0 || targetIns.style.display === "none") {
    for (const item of temporarilyHidden) {
      if (item.prevDisplay) {
        item.ins.style.display = item.prevDisplay;
      } else {
        item.ins.style.removeProperty("display");
      }
    }
    return false;
  }

  try {
    (window.adsbygoogle ||= []).push({});
    return true;
  } catch (error) {
    console.warn("AdSense:", error.message);
    return false;
  } finally {
    for (const item of temporarilyHidden) {
      if (item.prevDisplay) {
        item.ins.style.display = item.prevDisplay;
      } else {
        item.ins.style.removeProperty("display");
      }
    }
  }
}
