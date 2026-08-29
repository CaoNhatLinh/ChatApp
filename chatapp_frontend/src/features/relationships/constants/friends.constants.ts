import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizedCopy } from "@/shared/i18n";

const rawFriendCopy = {
  tabs: {
    all: UI_COPY.friends.tabs.all,
    friends: UI_COPY.friends.tabs.friends,
    requests: UI_COPY.friends.tabs.requests,
    add: UI_COPY.friends.tabs.add,
  },
  sectionTitle: {
    friends: UI_COPY.friends.sectionTitle.friends,
    requests: UI_COPY.friends.sectionTitle.requests,
    add: UI_COPY.friends.sectionTitle.add,
    friendsHeader: UI_COPY.friends.sectionTitle.friendsHeader,
  },
  filters: {
    searchPlaceholder: UI_COPY.friends.filters.searchPlaceholder,
    noFriendsHint: UI_COPY.friends.filters.noFriendsHint,
    noRequestsHint: UI_COPY.friends.filters.noRequestsHint,
    noSearchHint: UI_COPY.friends.filters.noSearchHint,
    noFriendsEmpty: UI_COPY.friends.filters.noFriendsEmpty,
    noRequestsEmpty: UI_COPY.friends.filters.noRequestsEmpty,
    noSearchEmpty: UI_COPY.friends.filters.noSearchEmpty,
    noSearchResultText: UI_COPY.friends.filters.noSearchResultText,
    friendCountSuffix: UI_COPY.friends.filters.friendCountSuffix,
    requestCountSuffix: UI_COPY.friends.filters.requestCountSuffix,
    resultsCountLabel: UI_COPY.friends.searchResultLabel,
  },
  row: {
    alreadyFriend: UI_COPY.friends.row.alreadyFriend,
    requestSent: UI_COPY.friends.row.requestSent,
    self: UI_COPY.friends.row.self,
    send: UI_COPY.friends.row.send,
  },
  actions: {
    openChat: UI_COPY.friends.actions.openChat,
    unfriend: UI_COPY.friends.actions.unfriend,
    unfriendConfirm: UI_COPY.friends.actions.unfriendConfirm,
    accept: UI_COPY.friends.actions.accept,
    reject: UI_COPY.friends.actions.reject,
    sentSuccess: UI_COPY.friends.actions.sentSuccess,
    sentFailed: UI_COPY.friends.actions.sentFailed,
    acceptSuccess: UI_COPY.friends.actions.acceptSuccess,
    acceptFailed: UI_COPY.friends.actions.acceptFailed,
    rejectSuccess: UI_COPY.friends.actions.rejectSuccess,
    rejectFailed: UI_COPY.friends.actions.rejectFailed,
    openChatSuccess: UI_COPY.friends.actions.openChatSuccess,
    openChatFailed: UI_COPY.friends.actions.openChatFailed,
    unfriendSuccess: UI_COPY.friends.actions.unfriendSuccess,
    unfriendFailed: UI_COPY.friends.actions.unfriendFailed,
  },
  status: {
    loading: UI_COPY.status.loading,
    searching: UI_COPY.status.searching,
    loadingDataHint: UI_COPY.status.loadingDataHint,
    notFound: UI_COPY.status.notFound,
    openProfileFailed: UI_COPY.status.openProfileFailed,
  },
} as const;

export const FRIEND_COPY = localizedCopy(rawFriendCopy);

