import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", (api) => {
  if (!settings.enable_math_quick_bar) {
    return;
  }

  const prefix = typeof api.themePrefix === "function" 
    ? (key) => api.themePrefix(key) 
    : (typeof themePrefix === "function" ? themePrefix : (key) => key);

  api.onToolbarCreate?.((toolbar) => {
    toolbar.addButton({
      id: "fkb-math-fraction",
      group: "extras",
      icon: "divide",
      title: prefix("fkb_math.fraction"),
      perform: (e) => e.applySurround("$\\frac{a}{b}$", ""),
    });

    toolbar.addButton({
      id: "fkb-math-sqrt",
      group: "extras",
      icon: "square-root-variable",
      title: prefix("fkb_math.sqrt"),
      perform: (e) => e.applySurround("$\\sqrt{x}$", ""),
    });

    toolbar.addButton({
      id: "fkb-math-power",
      group: "extras",
      icon: "superscript",
      title: prefix("fkb_math.power"),
      perform: (e) => e.applySurround("^{2}", ""),
    });
  });
});
