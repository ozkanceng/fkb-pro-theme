import { apiInitializer } from "discourse/lib/api";

const TOPIC_PATH = /^\/t\//;
const FIRST_POST_IMAGE_PRELOAD_ATTRIBUTE =
  "data-sorumatik-first-post-image-preload";
const PRIORITIZED_IMAGE_ATTRIBUTE = "data-sorumatik-first-post-image-priority";
const DEFAULTS = Object.freeze({
  adRootMargin: "600px 0px",
  consentEventName: "sorumatik:consent",
  consentStateGlobalName: "sorumatikConsent",
  firstPostImageMaxInlineWidth: 999,
  postLcpTimeoutMs: 3000,
  spaSettleMs: 350,
});

function idle(callback, timeout = 1) {
  if ("requestIdleCallback" in window) {
    return window.requestIdleCallback(callback, { timeout });
  }

  return window.setTimeout(callback, timeout);
}

function normalizeInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeEventName(value, fallback) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function normalizeRootMargin(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  const marginPart = "-?(?:\\d+|\\d*\\.\\d+)(?:px|%)";
  const pattern = new RegExp(`^${marginPart}(?:\\s+${marginPart}){0,3}$`);
  return pattern.test(normalized) ? normalized : DEFAULTS.adRootMargin;
}

function getPostFromHelper(helper) {
  try {
    const post = helper?.getPost?.();
    if (post) {
      return post;
    }
  } catch {
    // Continue through compatibility fallbacks used by newer Discourse builds.
  }

  if (helper?.model) {
    return helper.model;
  }

  try {
    return helper?.getModel?.();
  } catch {
    return undefined;
  }
}

function optimizedImageWidth(url) {
  if (typeof url !== "string" || !url.includes("/optimized/")) {
    return undefined;
  }

  const match = url.match(/_(\d+)x\d+\.[a-z0-9]+(?:\?.*)?$/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function capInlineImageSrcset(image, maximumWidth) {
  const sourceSet = image.getAttribute("srcset");
  if (!sourceSet) {
    return undefined;
  }

  const candidates = sourceSet
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => {
      const [url, ...descriptorParts] = candidate.split(/\s+/);
      return {
        descriptor: descriptorParts.join(" "),
        url,
        width: optimizedImageWidth(url),
      };
    });
  const optimizedCandidates = candidates.filter(
    (candidate) =>
      Number.isFinite(candidate.width) && candidate.width <= maximumWidth
  );

  if (!optimizedCandidates.length) {
    return sourceSet;
  }

  const cappedSourceSet = optimizedCandidates
    .map(({ descriptor, url }) => (descriptor ? `${url} ${descriptor}` : url))
    .join(", ");

  image.setAttribute("srcset", cappedSourceSet);
  return cappedSourceSet;
}

function removeFirstPostImagePreload() {
  document.head
    .querySelector(`link[${FIRST_POST_IMAGE_PRELOAD_ATTRIBUTE}]`)
    ?.remove();
}

function ensureFirstPostImagePreload(image, routeId, sourceSet) {
  const href = image.getAttribute("src");
  if (!href) {
    return;
  }

  const existingPreload = document.head.querySelector(
    `link[${FIRST_POST_IMAGE_PRELOAD_ATTRIBUTE}]`
  );
  const absoluteHref = new URL(href, window.location.href).href;
  if (
    existingPreload?.getAttribute(FIRST_POST_IMAGE_PRELOAD_ATTRIBUTE) ===
      String(routeId) &&
    existingPreload.href === absoluteHref &&
    existingPreload.getAttribute("imagesrcset") === (sourceSet || null)
  ) {
    return;
  }

  removeFirstPostImagePreload();

  const preload = document.createElement("link");
  preload.rel = "preload";
  preload.as = "image";
  preload.href = href;
  preload.fetchPriority = "high";
  preload.setAttribute("fetchpriority", "high");
  preload.setAttribute(FIRST_POST_IMAGE_PRELOAD_ATTRIBUTE, String(routeId));

  if (sourceSet) {
    preload.setAttribute("imagesrcset", sourceSet);
  }

  document.head.appendChild(preload);
}

function waitUntilInitialLcp(timeout, signal) {
  if (signal.aborted) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let finished = false;
    let observer;
    let settleTimer;
    let fallbackTimer;

    const finish = (completed) => {
      if (finished) {
        return;
      }

      finished = true;
      observer?.disconnect();
      window.clearTimeout(settleTimer);
      window.clearTimeout(fallbackTimer);
      signal.removeEventListener("abort", onAbort);

      if (!completed) {
        resolve(false);
        return;
      }

      idle(() => resolve(!signal.aborted));
    };
    const onAbort = () => finish(false);

    signal.addEventListener("abort", onAbort, { once: true });

    if ("PerformanceObserver" in window) {
      try {
        observer = new PerformanceObserver((list) => {
          if (!list.getEntries().length) {
            return;
          }

          window.clearTimeout(settleTimer);
          settleTimer = window.setTimeout(() => finish(true), 600);
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        // The bounded fallback handles older browsers.
      }
    }

    fallbackTimer = window.setTimeout(() => finish(true), timeout);
  });
}

function waitUntilSpaSettles(delay, signal) {
  if (signal.aborted) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let firstFrame;
    let secondFrame;
    let settleTimer;
    let finished = false;

    const finish = (completed) => {
      if (finished) {
        return;
      }

      finished = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(settleTimer);
      signal.removeEventListener("abort", onAbort);
      resolve(completed && !signal.aborted);
    };
    const onAbort = () => finish(false);

    signal.addEventListener("abort", onAbort, { once: true });
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        settleTimer = window.setTimeout(() => finish(true), delay);
      });
    });
  });
}

function waitUntilNearViewport(element, rootMargin, signal) {
  if (signal.aborted) {
    return Promise.resolve(false);
  }

  if (!element || !("IntersectionObserver" in window)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let finished = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          finish(true);
        }
      },
      { rootMargin }
    );

    const finish = (completed) => {
      if (finished) {
        return;
      }

      finished = true;
      observer.disconnect();
      signal.removeEventListener("abort", onAbort);
      resolve(completed && !signal.aborted);
    };
    const onAbort = () => finish(false);

    signal.addEventListener("abort", onAbort, { once: true });
    observer.observe(element);
  });
}

export default apiInitializer("1.8.0", (api) => {
  const themeSettings = typeof settings === "undefined" ? {} : settings;
  const config = Object.freeze({
    adRootMargin: normalizeRootMargin(themeSettings.ad_root_margin),
    consentEventName: normalizeEventName(
      themeSettings.consent_event_name,
      DEFAULTS.consentEventName
    ),
    consentRequired: themeSettings.consent_event_required === true,
    consentStateGlobalName: normalizeEventName(
      themeSettings.consent_state_global_name,
      DEFAULTS.consentStateGlobalName
    ),
    firstPostImageMaxInlineWidth: normalizeInteger(
      themeSettings.first_post_image_max_inline_width,
      DEFAULTS.firstPostImageMaxInlineWidth,
      320,
      2048
    ),
    postLcpTimeoutMs: normalizeInteger(
      themeSettings.post_lcp_timeout_ms,
      DEFAULTS.postLcpTimeoutMs,
      500,
      10000
    ),
    prioritizeFirstPostImage: themeSettings.prioritize_first_post_image !== false,
    spaSettleMs: normalizeInteger(
      themeSettings.spa_settle_ms,
      DEFAULTS.spaSettleMs,
      0,
      2000
    ),
  });

  let adsConsentGranted =
    !config.consentRequired || window[config.consentStateGlobalName]?.ads === true;
  let consentWaiters = [];
  let routeId = 0;
  let routeController;
  let currentRoute;
  let compatibilityWarningSent = false;

  const reportCompatibilityIssue = (message, error) => {
    if (compatibilityWarningSent) {
      return;
    }

    compatibilityWarningSent = true;
    // eslint-disable-next-line no-console
    console.warn(`[Sorumatik performance] ${message}`, error || "");
  };

  const isAnonymousTopic = () =>
    themeSettings.performance_optimizations_enabled !== false &&
    !api.getCurrentUser?.() &&
    TOPIC_PATH.test(window.location.pathname);

  const waitForAdsConsent = (signal) => {
    if (adsConsentGranted) {
      return Promise.resolve(true);
    }

    if (signal.aborted) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const waiter = {
        finish(completed) {
          signal.removeEventListener("abort", onAbort);
          consentWaiters = consentWaiters.filter((candidate) => candidate !== waiter);
          resolve(completed && !signal.aborted);
        },
      };
      const onAbort = () => waiter.finish(false);

      consentWaiters.push(waiter);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  };

  const releaseAdsConsent = () => {
    if (!adsConsentGranted) {
      return;
    }

    for (const waiter of consentWaiters.splice(0)) {
      waiter.finish(true);
    }
  };

  const beginRoute = ({ initial = false } = {}) => {
    const url = window.location.href;

    if (!initial && currentRoute?.url === url) {
      return;
    }

    removeFirstPostImagePreload();
    routeController?.abort();
    routeController = new AbortController();
    const id = ++routeId;
    const targeted = isAnonymousTopic();
    const ready = !targeted
      ? Promise.resolve(false)
      : initial
        ? waitUntilInitialLcp(config.postLcpTimeoutMs, routeController.signal)
        : waitUntilSpaSettles(config.spaSettleMs, routeController.signal);

    currentRoute = {
      controller: routeController,
      id,
      ready,
      targeted,
      url,
    };
  };

  const triggerAdOnce = async (component, originalTrigger, args, signal) => {
    if (signal.aborted || component.isDestroying || component.isDestroyed) {
      return;
    }

    try {
      await originalTrigger(...args);
    } catch (error) {
      reportCompatibilityIssue("Discourse Ad Plugin reklam çağrısı başarısız oldu.", error);
    }
  };

  try {
    api.modifyClass("component:google-adsense", {
      pluginId: "fkb-pro-theme",

      _triggerAds(...args) {
        if (currentRoute?.url !== window.location.href) {
          beginRoute();
        }

        if (typeof this._super !== "function") {
          reportCompatibilityIssue(
            "Google AdSense bileşeninin _triggerAds API'si değişmiş; optimizasyon atlandı."
          );
          return;
        }

        if (!isAnonymousTopic() || !currentRoute?.targeted) {
          return this._super(...args);
        }

        const routeSnapshot = currentRoute;
        if (
          this._sorumatikDeferredAdRequest &&
          this._sorumatikDeferredAdRouteId === routeSnapshot.id
        ) {
          return this._sorumatikDeferredAdRequest;
        }

        this._sorumatikAdController?.abort();
        const originalTrigger = this._super.bind(this);
        const adController = new AbortController();
        const abortForRouteChange = () => adController.abort();
        routeSnapshot.controller.signal.addEventListener("abort", abortForRouteChange, {
          once: true,
        });
        this._sorumatikAdController = adController;
        this._sorumatikDeferredAdRouteId = routeSnapshot.id;

        this._sorumatikDeferredAdRequest = (async () => {
          try {
            const routeReady = await routeSnapshot.ready;
            if (!routeReady || adController.signal.aborted) {
              return;
            }

            const initialConsent = await waitForAdsConsent(adController.signal);
            if (!initialConsent || adController.signal.aborted) {
              return;
            }

            const nearViewport = await waitUntilNearViewport(
              this.element,
              config.adRootMargin,
              adController.signal
            );
            if (!nearViewport || adController.signal.aborted) {
              return;
            }

            // Consent may have been withdrawn while this slot was offscreen.
            const finalConsent = await waitForAdsConsent(adController.signal);
            if (
              !finalConsent ||
              adController.signal.aborted ||
              this.isDestroying ||
              this.isDestroyed ||
              currentRoute?.id !== routeSnapshot.id ||
              !isAnonymousTopic()
            ) {
              return;
            }

            await triggerAdOnce(this, originalTrigger, args, adController.signal);
          } finally {
            routeSnapshot.controller.signal.removeEventListener("abort", abortForRouteChange);
          }
        })();

        return this._sorumatikDeferredAdRequest;
      },

      willDestroyElement(...args) {
        this._sorumatikAdController?.abort();
        return typeof this._super === "function" ? this._super(...args) : undefined;
      },
    });
  } catch (error) {
    reportCompatibilityIssue(
      "Discourse Ad Plugin bileşeni bulunamadı; standart reklam davranışı korunuyor.",
      error
    );
  }

  if (config.consentRequired) {
    window.addEventListener(config.consentEventName, (event) => {
      adsConsentGranted = event.detail?.ads === true;
      window[config.consentStateGlobalName] = {
        ...(window[config.consentStateGlobalName] || {}),
        ads: adsConsentGranted,
      };
      releaseAdsConsent();
    });
  }

  if (config.prioritizeFirstPostImage) {
    const prioritizeFirstPostImage = (element, helper) => {
      if (currentRoute?.url !== window.location.href) {
        beginRoute();
      }

      const post = getPostFromHelper(helper);
      if (!isAnonymousTopic() || Number(post?.post_number) !== 1) {
        return;
      }

      const image = [...element.querySelectorAll("img")].find(
        (candidate) =>
          !candidate.matches(".emoji, .avatar, [aria-hidden='true']") &&
          !candidate.closest("aside.quote, aside.accepted-answer, .quote")
      );
      if (!image) {
        return;
      }

      image.loading = "eager";
      image.setAttribute("loading", "eager");
      image.fetchPriority = "high";
      image.setAttribute("fetchpriority", "high");
      image.decoding = "async";
      image.setAttribute("decoding", "async");
      image.setAttribute(PRIORITIZED_IMAGE_ATTRIBUTE, "true");

      const sourceSet = capInlineImageSrcset(
        image,
        config.firstPostImageMaxInlineWidth
      );
      ensureFirstPostImagePreload(image, currentRoute?.id || routeId, sourceSet);
    };

    api.decorateCookedElement(prioritizeFirstPostImage, {
      id: "sorumatik-first-post-image-priority-before-adopt",
      onlyStream: true,
    });

    api.decorateCookedElement(prioritizeFirstPostImage, {
      afterAdopt: true,
      id: "sorumatik-first-post-image-priority-after-adopt",
      onlyStream: true,
    });
  }

  api.onPageChange(() => beginRoute());
  beginRoute({ initial: true });
});
