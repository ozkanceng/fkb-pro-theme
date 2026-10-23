import { apiInitializer } from "discourse/lib/api";
import { themePrefix } from "discourse-common/lib/theme-prefix";

export default apiInitializer("1.8.0", (api) => {
  if (!settings.enable_math_quick_bar) {
    return;
  }

  api.onToolbarCreate?.((toolbar) => {
    toolbar.addButton({
      id: "fkb-math-fraction",
      group: "extras",
      icon: "divide",
      title: themePrefix("fkb_math.fraction"),
      perform: (e) => e.applySurround("$\\frac{", "}{b}$", "a"),
    });

    toolbar.addButton({
      id: "fkb-math-sqrt",
      group: "extras",
      icon: "square-root-variable",
      title: themePrefix("fkb_math.sqrt"),
      perform: (e) => e.applySurround("$\\sqrt{", "}$", "x"),
    });

    toolbar.addButton({
      id: "fkb-math-power",
      group: "extras",
      icon: "superscript",
      title: themePrefix("fkb_math.power"),
      perform: (e) => e.applySurround("^{", "}", "2"),
    });
  });
});
