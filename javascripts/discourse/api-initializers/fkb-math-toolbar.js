import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.8.0", (api) => {
  if (!settings.enable_math_quick_bar) {
    return;
  }

  api.onToolbarCreate?.((toolbar) => {
    toolbar.addButton({
      id: "fkb-math-fraction",
      group: "extras",
      icon: "divide",
      title: "theme_metadata.fkb_math.fraction",
      perform: (e) => e.applySurround("$\\frac{", "}{b}$", "a"),
    });

    toolbar.addButton({
      id: "fkb-math-sqrt",
      group: "extras",
      icon: "square-root-variable",
      title: "theme_metadata.fkb_math.sqrt",
      perform: (e) => e.applySurround("$\\sqrt{", "}$", "x"),
    });

    toolbar.addButton({
      id: "fkb-math-power",
      group: "extras",
      icon: "superscript",
      title: "theme_metadata.fkb_math.power",
      perform: (e) => e.applySurround("^{", "}", "2"),
    });
  });
});
