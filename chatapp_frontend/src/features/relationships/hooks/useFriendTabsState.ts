import { useCallback, useEffect, useMemo, useState } from "react";
import { useFriendStore } from "../model/friend.store";
import {
  useFetchFriends,
  useFetchReceivedRequests,
  useFetchSentRequests,
  useFriends,
  useLoadingFriends,
  useLoadingReceived,
  useLoadingSearch,
  useLoadingSent,
  useReceivedRequests,
} from "../model/friend.store";

export type ContactListTab = "friends" | "requests" | "add";

export const useFriendTabsState = () => {
  const [activeTab, setActiveTab] = useState<ContactListTab>("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  const friendsData = useFriends();
  const requestsData = useReceivedRequests();
  const sentRequestsData = useFriendStore((state) => state.pendingRequests);
  const searchResults = useFriendStore((state) => state.searchResults);

  const fetchFriendsAction = useFetchFriends();
  const fetchReceivedRequestsAction = useFetchReceivedRequests();
  const fetchSentRequestsAction = useFetchSentRequests();
  const loadingFriends = useLoadingFriends();
  const loadingReceived = useLoadingReceived();
  const loadingSent = useLoadingSent();
  const loadingSearch = useLoadingSearch();
  const error = useFriendStore((state) => state.error);

  const searchUsersAction = useFriendStore((state) => state.searchUsers);

  const friends = useMemo(() => friendsData?.userDetails ?? [], [friendsData]);
  const requests = useMemo(() => requestsData?.userDetails ?? [], [requestsData]);
  const sentRequestIds = useMemo(
    () => new Set(sentRequestsData?.userDetails.map((person) => person.userId) ?? []),
    [sentRequestsData]
  );

  const visibleFriends = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return friends;
    }

    return friends.filter((person) => {
      const label = person.displayName.toLowerCase();
      return label.includes(normalized);
    });
  }, [friends, searchQuery]);

  useEffect(() => {
    if (activeTab === "friends") {
      void fetchFriendsAction();
    } else if (activeTab === "requests") {
      void fetchReceivedRequestsAction();
    } else {
      void fetchSentRequestsAction();
    }
  }, [activeTab, fetchFriendsAction, fetchReceivedRequestsAction, fetchSentRequestsAction]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchUsersAction(globalSearchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [globalSearchQuery, searchUsersAction]);

  const retryCurrentTab = useCallback(async () => {
    if (activeTab === "friends") {
      await fetchFriendsAction();
      return;
    }
    if (activeTab === "requests") {
      await fetchReceivedRequestsAction();
      return;
    }
    if (globalSearchQuery.trim().length >= 3) {
      await searchUsersAction(globalSearchQuery);
    }
  }, [activeTab, fetchFriendsAction, fetchReceivedRequestsAction, globalSearchQuery, searchUsersAction]);

  return {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    globalSearchQuery,
    setGlobalSearchQuery,
    friends,
    visibleFriends,
    requests,
    searchResults,
    sentRequestIds,
    loadingFriends,
    loadingReceived,
    loadingSearch,
    loadingSent,
    error,
    retryCurrentTab,
    isLoadingCurrentTab:
      activeTab === "friends"
        ? loadingFriends
        : activeTab === "requests"
          ? loadingReceived
          : loadingSearch || loadingSent,
  };
};
