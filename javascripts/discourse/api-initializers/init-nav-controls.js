import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", (api) => {
  const body = document.body;
  const hiddenNavClass = "nav-controls-hidden";
  const SCROLL_DELTA_THRESHOLD = 12;
  let lastScrollTop = window.scrollY || 0;
  let frameId = null;
  let isHidden = false;

  const updateNavigation = () => {
    frameId = null;

    const capabilities = api.container.lookup("service:capabilities");
    const viewportSm = capabilities?.viewport?.sm;

    if (viewportSm) {
      if (isHidden) {
        isHidden = false;
        body.classList.remove(hiddenNavClass);
      }
      return;
    }

    const scrollTop = window.scrollY || 0;
    const delta = scrollTop - lastScrollTop;

    if (scrollTop <= 10) {
      if (isHidden) {
        isHidden = false;
        body.classList.remove(hiddenNavClass);
      }
    } else if (Math.abs(delta) >= SCROLL_DELTA_THRESHOLD) {
      if (delta > 0 && !isHidden) {
        isHidden = true;
        body.classList.add(hiddenNavClass);
      } else if (delta < 0 && isHidden) {
        isHidden = false;
        body.classList.remove(hiddenNavClass);
      }
    }

    lastScrollTop = Math.max(0, scrollTop);
  };

  const onScroll = () => {
    if (frameId !== null) {
      return;
    }

    frameId = window.requestAnimationFrame(updateNavigation);
  };

  api.onPageChange(() => {
    lastScrollTop = window.scrollY || 0;
    if (isHidden) {
      isHidden = false;
      body.classList.remove(hiddenNavClass);
    }
  });

  window.addEventListener("scroll", onScroll, { passive: true });
});
