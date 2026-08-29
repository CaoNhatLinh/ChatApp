import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizedCopy } from "@/shared/i18n";

const rawSearchCopy = {
  pageTitle: UI_COPY.search.pageTitle,
  pageDescription: UI_COPY.search.pageDescription,
  queryLabel: UI_COPY.search.queryLabel,
  queryPlaceholder: UI_COPY.search.queryPlaceholder,
  scopes: UI_COPY.search.scopes,
  targets: UI_COPY.search.targets,
  resultTitlePrefix: UI_COPY.search.resultTitlePrefix,
  resultDescriptionWithQuery: UI_COPY.search.resultDescriptionWithQuery,
  resultDescriptionDefault: UI_COPY.search.resultDescriptionDefault,
  loadingRowCount: 4,
  emptyMessage: MESSENGER_COPY.search.messageFilter.emptyMessage,
  noFilterMessage: UI_COPY.friends.filters.noSearchHint,
  messageFilter: {
    senderIdPlaceholder: MESSENGER_COPY.search.messageFilter.senderIdPlaceholder,
    mentionedUserPlaceholder: MESSENGER_COPY.search.messageFilter.mentionedUserPlaceholder,
    replyToSenderIdPlaceholder: MESSENGER_COPY.search.messageFilter.replyToSenderIdPlaceholder,
    typeLabel: MESSENGER_COPY.search.messageFilter.typeLabel,
    messageTypeOptions: MESSENGER_COPY.search.messageFilter.messageTypeOptions,
    attachmentLabel: MESSENGER_COPY.search.messageFilter.attachmentLabel,
    attachmentOptions: MESSENGER_COPY.search.messageFilter.attachmentOptions,
    pinnedLabel: MESSENGER_COPY.search.messageFilter.pinnedLabel,
    pinnedOptions: MESSENGER_COPY.search.messageFilter.pinnedOptions,
    fromLabel: MESSENGER_COPY.search.messageFilter.fromLabel,
    toLabel: MESSENGER_COPY.search.messageFilter.toLabel,
    clearLabel: MESSENGER_COPY.search.messageFilter.clearLabel,
    disabledHint: MESSENGER_COPY.search.messageFilter.disabledHint,
  },
} as const;

export const SEARCH_COPY = localizedCopy(rawSearchCopy);
