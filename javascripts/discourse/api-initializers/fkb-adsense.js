import { apiInitializer } from "discourse/lib/api";
import { computed } from "@ember/object";
import { isTesting } from "discourse/lib/environment";
import { loadAdsense, safePushAd, waitForAdWidth } from "../lib/fkb-adsense";

let nextAdId = 0;
const adIds = new WeakMap();
function adClass(component) {
  if (!adIds.has(component)) {
    adIds.set(component, ++nextAdId);
  }
  return `fkb-adsense-${adIds.get(component)}`;
}

function optimizeTopicImages() {
  const firstPostImg = document.querySelector(
    "#post_1 .cooked img:not(.avatar):not(.emoji)"
  );
  if (firstPostImg) {
    firstPostImg.setAttribute("fetchpriority", "high");
    firstPostImg.setAttribute("loading", "eager");
    firstPostImg.setAttribute("decoding", "async");
  }

  const replyImages = document.querySelectorAll(
    "article:not(#post_1) .cooked img:not(.avatar):not(.emoji)"
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

export default apiInitializer("1.8.0", (api) => {
  if (isTesting()) {
    return;
  }
  const siteSettings = api.container.lookup("service:site-settings");

  // Optimize LCP & offscreen post images on every page navigation
  api.onPageChange((url) => {
    optimizeTopicImages();

    if (!siteSettings?.adsense_publisher_code) {
      return;
    }
    // Admin pages must not launch Auto ads (including navigation vignettes).
    if (/^\/admin(?:\/|$|\?)/.test(url)) {
      return;
    }
    loadAdsense(siteSettings.adsense_publisher_code).catch((error) => {
      console.warn("AdSense:", error.message);
    });
  });

  if (!siteSettings?.adsense_publisher_code) {
    return;
  }

  // Preserve the plugin's templates, placements, group and user exclusions.
  // Replace its legacy script and premature trigger stage to prevent width=0, width=52 and duplicate push errors.
  api.modifyClass("component:google-adsense", {
    pluginId: "fkb-single-adsense-loader",
    // The ad plugin uses a tagless component: this.element is absent.
    // Give its existing template a stable per-instance class instead.
    classForSlot: computed("placement", "showAd", function () {
      const show = this.get ? this.get("showAd") : this.showAd;
      const placement = this.get ? this.get("placement") : this.placement;
      return show ? `adsense-${placement} ${adClass(this)}` : "";
    }),
    _triggerAds() {
      const show = this.get ? this.get("showAd") : this.showAd;
      if (
        /^\/admin(?:\/|$)/.test(window.location.pathname) ||
        this._fkbAdPending ||
        this.adRequested ||
        !show
      ) {
        return;
      }

      const root = document.querySelector(`.${adClass(this)}`);
      const ins = root?.querySelector("ins.adsbygoogle");
      if (!ins || ins.hasAttribute("data-adsbygoogle-status")) {
        return;
      }

      this._fkbAdPending = true;
      this._fkbCancelAd = waitForAdWidth(ins, 120, async () => {
        try {
          await loadAdsense(
            this.publisher_id || siteSettings.adsense_publisher_code
          );
          const stillShow = this.get ? this.get("showAd") : this.showAd;
          if (
            this.isDestroying ||
            this.isDestroyed ||
            !stillShow ||
            !ins.isConnected ||
            ins.hasAttribute("data-adsbygoogle-status")
          ) {
            return;
          }

          const pushed = safePushAd(ins, 120);
          if (pushed) {
            if (typeof this.set === "function") {
              this.set("adRequested", true);
            } else {
              this.adRequested = true;
            }
          } else {
            this._fkbAdPending = false;
            this._triggerAds();
          }
        } catch (error) {
          this._fkbAdPending = false;
          console.warn("AdSense:", error.message);
        }
      });
    },
    willDestroyElement() {
      this._fkbCancelAd?.();
      this._super?.(...arguments);
    },
    willDestroy() {
      this._fkbCancelAd?.();
      this._super?.(...arguments);
    },
  });
});
