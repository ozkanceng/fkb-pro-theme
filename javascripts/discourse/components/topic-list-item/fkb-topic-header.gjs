import { get } from "@ember/helper";
import UserLink from "discourse/components/user-link";
import avatar from "discourse/helpers/avatar";
import formatDate from "discourse/helpers/format-date";
import categoryLink from "discourse/helpers/category-link";
import icon from "discourse/helpers/d-icon";
import i18n from "discourse-common/helpers/i18n";
import FkbTopicListSection from "./fkb-topic-list-section";

export default class FkbTopicHeader extends FkbTopicListSection {
  get educationMode() {
    return settings.education_mode;
  }

  get isSolved() {
    return Boolean(this.topic.has_accepted_answer);
  }

  get isUnanswered() {
    return !this.isSolved && this.topic.replyCount === 0;
  }

  get isAnswered() {
    return !this.isSolved && this.topic.replyCount > 0;
  }

  <template>
    <div class="tli-top-section">
      <div class="tli-top-section__meta">
        <div class="tli-top-section__category">
          {{#unless this.topic.hideCategory}}
            {{#unless this.topic.isPinnedUncategorized}}
              {{categoryLink this.topic.category}}
            {{/unless}}
          {{/unless}}
        </div>

        {{#if this.educationMode}}
          <div class="tli-top-section__status">
            {{#if this.isSolved}}
              <span class="fkb-edu-status fkb-edu-status--solved">
                {{icon "check"}}
                <span class="fkb-edu-status__label">{{i18n (themePrefix "education.solved")}}</span>
              </span>
            {{else if this.isUnanswered}}
              <span class="fkb-edu-status fkb-edu-status--unanswered">
                {{icon "clock"}}
                <span class="fkb-edu-status__label">{{i18n (themePrefix "education.waiting_answer")}}</span>
              </span>
            {{else if this.isAnswered}}
              <span class="fkb-edu-status fkb-edu-status--answered">
                {{icon "comment-dots"}}
                <span class="fkb-edu-status__label">{{this.topic.replyCount}} {{i18n (themePrefix "education.answered")}}</span>
              </span>
            {{/if}}
          </div>
        {{/if}}
      </div>

      <div class="tli-top-section__author">
        <UserLink @user={{get this.topic.posters "0.user"}}>
          <div class="topic-list-avatar">
            {{avatar (get this.topic.posters "0.user") imageSize="large"}}
            <div class="name-and-date">
              <span class="full-name-tlist">{{this.topic.creator.name}}</span>
              <span class="username">{{this.topic.creator.username}}</span>
              <time
                class="list-date"
                datetime={{this.topic.createdAt}}
              >
                {{i18n (themePrefix "created_at")}}
                {{formatDate this.topic.createdAt format="tiny"}}
              </time>
            </div>
          </div>
        </UserLink>
      </div>
    </div>
  </template>
}
