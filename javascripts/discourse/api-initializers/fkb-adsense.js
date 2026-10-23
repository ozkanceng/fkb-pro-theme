import { apiInitializer } from "discourse/lib/api";
import { computed } from "@ember/object";
import { isTesting } from "discourse/lib/environment";
import { loadAdsense, waitForAdWidth } from "../lib/fkb-adsense";

let nextAdId = 0;
const adIds = new WeakMap();
function adClass(component) {
  if (!adIds.has(component)) {
    adIds.set(component, ++nextAdId);
  }
  return `fkb-adsense-${adIds.get(component)}`;
}

const PRELOAD_ATTR = "data-fkb-lcp-preload";

function getPostFromHelper(helper) {
  try {
    const post = helper?.getPost?.();
    if (post) {
      return post;
    }
  } catch {
    // compatibility fallback
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

function prioritizeFirstPostImage(element, helper) {
  const post = getPostFromHelper(helper);
  const postNumber = Number(post?.post_number);

  if (postNumber === 1) {
    const firstImg = element.querySelector(
      "img:not(.avatar):not(.emoji):not([aria-hidden='true'])"
    );
    if (!firstImg) {
      return;
    }

    firstImg.loading = "eager";
    firstImg.setAttribute("loading", "eager");
    firstImg.fetchPriority = "high";
    firstImg.setAttribute("fetchpriority", "high");
    firstImg.decoding = "async";
    firstImg.setAttribute("decoding", "async");

    const src = firstImg.getAttribute("src");
    if (src && !document.head.querySelector(`link[${PRELOAD_ATTR}]`)) {
      const preload = document.createElement("link");
      preload.rel = "preload";
      preload.as = "image";
      preload.href = src;
      preload.fetchPriority = "high";
      preload.setAttribute("fetchpriority", "high");
      preload.setAttribute(PRELOAD_ATTR, "true");

      const srcset = firstImg.getAttribute("srcset");
      if (srcset) {
        preload.setAttribute("imagesrcset", srcset);
      }
      document.head.appendChild(preload);
    }
  } else if (postNumber > 1) {
    const replyImages = element.querySelectorAll(
      "img:not(.avatar):not(.emoji)"
    );
    for (const img of replyImages) {
      if (!img.hasAttribute("loading")) {
        img.setAttribute("loading", "lazy");
      }
      if (!img.hasAttribute("decoding")) {
        img.setAttribute("decoding", "async");
      }
    }
  }
}

export default apiInitializer("1.8.0", (api) => {
  if (isTesting()) {
    return;
  }

  // Preload and optimize LCP question image in post stream
  api.decorateCookedElement(prioritizeFirstPostImage, {
    id: "fkb-lcp-image-priority",
    onlyStream: true,
  });

  const siteSettings = api.container.lookup("service:site-settings");
  if (!siteSettings?.adsense_publisher_code) {
    return;
  }

  // Clean up LCP preload on route changes
  api.onPageChange((url) => {
    document.head.querySelector(`link[${PRELOAD_ATTR}]`)?.remove();

    if (/^\/admin(?:\/|$|\?)/.test(url)) {
      return;
    }
    loadAdsense(siteSettings.adsense_publisher_code).catch((error) => {
      console.warn("AdSense:", error.message);
    });
  });

  // Preserve the plugin's templates, placements, group and user exclusions.
  // Only replace its legacy (client-less) script and request stage.
  api.modifyClass("component:google-adsense", {
    pluginId: "fkb-single-adsense-loader",
    classForSlot: computed("placement", "showAd", function () {
      return this.get("showAd")
        ? `adsense-${this.placement} ${adClass(this)}`
        : "";
    }),
    _triggerAds() {
      if (
        /^\/admin(?:\/|$)/.test(window.location.pathname) ||
        this._fkbAdPending ||
        this.adRequested ||
        !this.get("showAd")
      ) {
        return;
      }

      const root = document.querySelector(`.${adClass(this)}`);
      const ins = root?.querySelector("ins.adsbygoogle");
      if (!ins) {
        return;
      }

      this._fkbAdPending = true;
      this._fkbCancelAd = waitForAdWidth(ins, async () => {
        try {
          await loadAdsense(this.publisher_id || siteSettings.adsense_publisher_code);
          if (
            this.isDestroying ||
            this.isDestroyed ||
            !this.get("showAd") ||
            !ins.isConnected
          ) {
            return;
          }
          if (ins.getBoundingClientRect().width <= 0) {
            this._fkbAdPending = false;
            this._triggerAds();
            return;
          }
          if (!ins.hasAttribute("data-adsbygoogle-status")) {
            this.set("adRequested", true);
            (window.adsbygoogle ||= []).push({});
          }
        } catch (error) {
          console.warn("AdSense:", error.message);
        }
      });
    },
    willDestroyElement() {
      this._fkbCancelAd?.();
      this._super(...arguments);
    },
  });
});
