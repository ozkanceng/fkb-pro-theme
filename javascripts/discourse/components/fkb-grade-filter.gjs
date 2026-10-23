import Component from "@glimmer/component";
import i18n from "discourse-common/helpers/i18n";

export default class FkbGradeFilter extends Component {
  get showFilter() {
    return settings.education_mode && settings.enable_education_category_pills;
  }

  get filterPills() {
    return [
      { labelKey: "fkb_filter.latest", url: "/latest" },
      { labelKey: "fkb_filter.unsolved", url: "/filter?solved=no" },
      { labelKey: "fkb_filter.solved", url: "/filter?solved=yes" },
      { labelKey: "fkb_filter.top", url: "/top" },
      { labelKey: "fkb_filter.tyt_yks", url: "/tag/tyt" },
      { labelKey: "fkb_filter.lgs", url: "/tag/lgs" },
      { labelKey: "fkb_filter.grade_9", url: "/tag/9-sinif" },
      { labelKey: "fkb_filter.grade_10", url: "/tag/10-sinif" },
      { labelKey: "fkb_filter.grade_11", url: "/tag/11-sinif" },
      { labelKey: "fkb_filter.grade_12", url: "/tag/12-sinif" },
      { labelKey: "fkb_filter.math", url: "/c/ders-notlari/10" },
      { labelKey: "fkb_filter.physics", url: "/tag/fizik" },
      { labelKey: "fkb_filter.chemistry", url: "/tag/kimya" },
      { labelKey: "fkb_filter.biology", url: "/tag/biyoloji" },
    ];
  }

  <template>
    {{#if this.showFilter}}
      <nav class="fkb-grade-filter-bar" aria-label={{i18n (themePrefix "fkb_filter.label")}}>
        <div class="fkb-grade-filter-scroll">
          {{#each this.filterPills as |pill|}}
            <a href={{pill.url}} class="fkb-grade-pill">
              <span class="fkb-grade-pill__label">{{i18n (themePrefix pill.labelKey)}}</span>
            </a>
          {{/each}}
        </div>
      </nav>
    {{/if}}
  </template>
}
