import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", (api) => {
  api.decorateCookedElement(
    (cooked, helper) => {
      if (!cooked) {
        return;
      }

      // Identify if this post is post #1
      const post = helper?.getModel ? helper.getModel() : helper?.model;
      const isPost1 = post ? Number(post.post_number) === 1 : false;

      // Also check fallback for post_1 in DOM
      const isInsidePost1 = cooked.closest("#post_1") || cooked.closest("article[data-post-id]");
      const isFirstArticle = document.querySelector("#post_1 .cooked") === cooked;

      if (!isPost1 && !isFirstArticle) {
        return;
      }

      requestAnimationFrame(() => {
        if (cooked.dataset.sorumatikCollapseReady === "true") {
          return;
        }

        // Check content height (threshold: 260px)
        const contentHeight = cooked.scrollHeight;
        if (contentHeight <= 280) {
          return;
        }

        cooked.dataset.sorumatikCollapseReady = "true";
        cooked.classList.add("sorumatik-collapsed");

        // Create the elegant expand button wrapper
        const wrapper = document.createElement("div");
        wrapper.className = "sorumatik-expand-wrapper";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-default sorumatik-expand-btn";
        btn.setAttribute("aria-expanded", "false");
        btn.innerHTML = '<span>Devamını Gör</span> <svg class="fa d-icon d-icon-angle-down svg-icon" aria-hidden="true"><use href="#angle-down"></use></svg>';

        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const isCollapsed = cooked.classList.contains("sorumatik-collapsed");

          if (isCollapsed) {
            cooked.classList.remove("sorumatik-collapsed");
            cooked.classList.add("sorumatik-expanded");
            btn.setAttribute("aria-expanded", "true");
            btn.innerHTML = '<span>Daha Az Göster</span> <svg class="fa d-icon d-icon-angle-up svg-icon" aria-hidden="true"><use href="#angle-up"></use></svg>';
          } else {
            cooked.classList.remove("sorumatik-expanded");
            cooked.classList.add("sorumatik-collapsed");
            btn.setAttribute("aria-expanded", "false");
            btn.innerHTML = '<span>Devamını Gör</span> <svg class="fa d-icon d-icon-angle-down svg-icon" aria-hidden="true"><use href="#angle-down"></use></svg>';
            cooked.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        });

        wrapper.appendChild(btn);
        cooked.after(wrapper);
      });
    },
    { id: "sorumatik-question-collapse", onlyStream: true }
  );
});
