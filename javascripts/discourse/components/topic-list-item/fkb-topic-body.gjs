import { htmlSafe } from "@ember/template";
import dirSpan from "discourse/helpers/dir-span";
import i18n from "discourse-common/helpers/i18n";
import discourseTags from "discourse/helpers/discourse-tags";
import FkbTopicListSection from "./fkb-topic-list-section";
import FkbTopicMeta from "./fkb-topic-meta";

export default class FkbTopicBody extends FkbTopicListSection {
  get topicBackgroundStyle() {
    return htmlSafe(`background-image: url(${this.topic.image_url})`);
  }

  get isAdaptiveFit() {
    return Boolean(settings.topic_image_adaptive_fit);
  }

  get isFirstTopic() {
    return this.args?.outletArgs?.index === 0;
  }

  get imageLoading() {
    return this.isFirstTopic ? "eager" : "lazy";
  }

  get imageFetchPriority() {
    return this.isFirstTopic ? "high" : "low";
  }

  <template>
    <div class="tli-middle-section">
      {{#if this.topic.hasExcerpt}}
        <div class="topic-excerpt">
          <a href={{this.topic.url}} class="topic-excerpt-link">
            {{dirSpan this.topic.escapedExcerpt htmlSafe="true"}}
            {{#if this.topic.excerptTruncated}}
              <span class="topic-excerpt-more">{{i18n "read_more"}}</span>
            {{/if}}
          </a>
        </div>
      {{/if}}

      {{#if this.topic.image_url}}
        <a href={{this.topic.url}} class="topic-image-link">
          <div class="topic-image {{if this.isAdaptiveFit "topic-image--adaptive"}} {{if settings.topic_image_backdrop "topic-image--has-backdrop"}}">
            {{#if settings.topic_image_backdrop}}
              <div
                class="topic-image__backdrop"
                style={{this.topicBackgroundStyle}}
              ></div>
            {{/if}}
            <img
              src={{this.topic.image_url}}
              class="topic-image__img"
              loading={{this.imageLoading}}
              decoding="async"
              fetchpriority={{this.imageFetchPriority}}
              alt={{this.topic.fancyTitle}}
            >
          </div>
        </a>
      {{/if}}

      {{discourseTags this.topic mode="list" tagsForUser=this.tagsForUser}}
    </div>

    <FkbTopicMeta @outletArgs={{@outletArgs}} />
  </template>
}
