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

export default apiInitializer("1.8.0", (api) => {
  if (isTesting()) {
    return;
  }
  const siteSettings = api.container.lookup("service:site-settings");
  if (!siteSettings?.adsense_publisher_code) {
    return;
  }

  // Admin pages must not launch Auto ads (including navigation vignettes).
  // onPageChange also handles entering the public forum from an admin page.
  api.onPageChange((url) => {
    if (/^\/admin(?:\/|$|\?)/.test(url)) {
      return;
    }
    loadAdsense(siteSettings.adsense_publisher_code).catch((error) => {
      console.warn("AdSense:", error.message);
    });
  });

  // Preserve the plugin's templates, placements, group and user exclusions.
  // Replace its legacy script and premature trigger stage to prevent width=0 and width=52 errors.
  api.modifyClass("component:google-adsense", {
    pluginId: "fkb-single-adsense-loader",
    // The ad plugin uses a tagless component: this.element is absent.
    // Give its existing template a stable per-instance class instead.
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
      this._fkbCancelAd = waitForAdWidth(ins, 120, async () => {
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
          if (ins.getBoundingClientRect().width < 120) {
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
