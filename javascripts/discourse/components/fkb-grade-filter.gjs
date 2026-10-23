import Component from "@glimmer/component";
import icon from "discourse/helpers/d-icon";
import i18n from "discourse-common/helpers/i18n";

export default class FkbGradeFilter extends Component {
  get showFilter() {
    return settings.education_mode && settings.enable_education_category_pills;
  }

  get filterPills() {
    return [
      { labelKey: "fkb_filter.all", url: "/latest", icon: "layer-group" },
      { labelKey: "fkb_filter.tyt_yks", url: "/tag/tyt", icon: "graduation-cap" },
      { labelKey: "fkb_filter.lgs", url: "/tag/lgs", icon: "book-open" },
      { labelKey: "fkb_filter.grade_9", url: "/tag/9-sinif" },
      { labelKey: "fkb_filter.grade_10", url: "/tag/10-sinif" },
      { labelKey: "fkb_filter.grade_11", url: "/tag/11-sinif" },
      { labelKey: "fkb_filter.grade_12", url: "/tag/12-sinif" },
      { labelKey: "fkb_filter.math", url: "/c/ders-notlari/10", icon: "calculator" },
      { labelKey: "fkb_filter.physics", url: "/tag/fizik", icon: "atom" },
      { labelKey: "fkb_filter.chemistry", url: "/tag/kimya", icon: "flask" },
      { labelKey: "fkb_filter.biology", url: "/tag/biyoloji", icon: "dna" },
    ];
  }

  <template>
    {{#if this.showFilter}}
      <nav class="fkb-grade-filter-bar" aria-label="Sınıf ve Ders Filtreleri">
        <div class="fkb-grade-filter-scroll">
          {{#each this.filterPills as |pill|}}
            <a href={{pill.url}} class="fkb-grade-pill">
              {{#if pill.icon}}
                {{icon pill.icon}}
              {{/if}}
              <span class="fkb-grade-pill__label">{{i18n (themePrefix pill.labelKey)}}</span>
            </a>
          {{/each}}
        </div>
      </nav>
    {{/if}}
  </template>
}
