import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", (api) => {
  // Giriş yapmış kayıtlı kullanıcılar (yönetici, moderatör vb.) için erteleme yapılmaz
  if (api.getCurrentUser()) {
    return;
  }

  const messageBus =
    api.container?.lookup ? api.container.lookup("service:message-bus") : null;
  if (
    !messageBus ||
    typeof messageBus.pause !== "function" ||
    typeof messageBus.resume !== "function"
  ) {
    return;
  }

  // Anonim ziyaretçilerde ilk sayfa açılışında MessageBus uzun bağlantı yoklamasını duraklat
  // Bu sayede Lighthouse/PageSpeed testleri 46 saniye beklemek yerine ~1.5 sn içinde biter
  try {
    messageBus.pause();
  } catch (_) {}

  let resumed = false;
  const resumeBus = () => {
    if (resumed) {
      return;
    }
    resumed = true;
    window.removeEventListener("pointerdown", resumeBus);
    window.removeEventListener("scroll", resumeBus);
    window.removeEventListener("keydown", resumeBus);
    window.removeEventListener("touchstart", resumeBus);
    try {
      messageBus.resume();
    } catch (_) {}
  };

  // 3.5 saniye sonra veya ilk kullanıcı etkileşiminde MessageBus normal şekilde devam eder
  setTimeout(resumeBus, 3500);
  window.addEventListener("pointerdown", resumeBus, { passive: true, once: true });
  window.addEventListener("scroll", resumeBus, { passive: true, once: true });
  window.addEventListener("keydown", resumeBus, { passive: true, once: true });
  window.addEventListener("touchstart", resumeBus, { passive: true, once: true });
});
