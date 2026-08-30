import { Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppPageShell } from "@/route-pages/shared/AppPageShell";
import { SectionHeader } from "@/shared/ui/SectionHeader";
import { SurfacePanel } from "@/shared/ui/SurfacePanel";
import { SearchResultItem } from "@/route-pages/search/components/SearchResultItem";
import { SEARCH_COPY } from "@/route-pages/search/constants/search.constants";
import SearchResultSkeleton from "@/route-pages/search/components/SearchResultSkeleton";
import { searchMessages, type MessageSearchFilters } from "@/features/messenger/api/messenger.api";
import { motion } from "framer-motion";
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from "@/shared/constants/ui-motion-variants";
import { localizeText, useAppLocale } from "@/shared/i18n";
import { logger } from "@/shared/lib/logger";
import { getUserFacingErrorMessage } from "@/shared/lib/user-facing-error";

interface SearchData {
  title: string;
  path: string;
  description: string;
  category: "chat" | "friends" | "settings" | "public";
}

type SearchScope = "all" | SearchData["category"];
type TriStateFilter = "all" | "true" | "false";

const SEARCH_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const isRequestCanceled = (error: unknown) => {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }

  if (error === null || typeof error !== "object") {
    return false;
  }

  const errorRecord = error as Record<string, unknown>;
  return errorRecord.name === "CanceledError" || errorRecord.code === "ERR_CANCELED";
};

const toIsoDate = (value: string) => {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString();
};

const isValidUuid = (value: string) => {
  if (!value.trim()) return true;
  return UUID_REGEX.test(value.trim());
};

export const SearchPage = () => {
  useAppLocale();
  const scopeFilters: ReadonlyArray<{ value: SearchScope; label: string }> = SEARCH_COPY.scopes;
  const searchTargets: SearchData[] = useMemo(() => SEARCH_COPY.targets.map((target): SearchData => ({
    ...target,
    category: target.category,
  })), []);
  const messageTypeOptions = SEARCH_COPY.messageFilter.messageTypeOptions;
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [messageSearchResults, setMessageSearchResults] = useState<SearchData[]>([]);
  const [messageNextCursor, setMessageNextCursor] = useState<string>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [messageType, setMessageType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [attachmentFilter, setAttachmentFilter] = useState<TriStateFilter>("all");
  const [pinnedFilter, setPinnedFilter] = useState<TriStateFilter>("all");
  const searchParams = useSearchParams();
  const [validationError, setValidationError] = useState<string | null>(null);

  const conversationId = searchParams.get("conversationId")?.trim() ?? "";
  const hasConversationId = conversationId.length > 0;
  const hasValidConversationId = hasConversationId ? isValidUuid(conversationId) : false;
  const requestIdRef = useRef(0);
  const activeMessageFilterRef = useRef<MessageSearchFilters | null>(null);

  const hasMessageFilter = Boolean(
    query.trim() ||
      messageType ||
      fromDate.trim() ||
      toDate.trim() ||
      attachmentFilter !== "all" ||
      pinnedFilter !== "all"
  );
  const messageFilterCount = [
    messageType,
    fromDate.trim(),
    toDate.trim(),
    attachmentFilter !== "all" ? attachmentFilter : "",
    pinnedFilter !== "all" ? pinnedFilter : "",
  ].filter(Boolean).length;

  const isMessageScopeEnabled = scope === "chat" || scope === "all";
  const canSearchMessages =
    isMessageScopeEnabled &&
    hasMessageFilter &&
    hasConversationId &&
    hasValidConversationId;

  const localResults = useMemo(() => {
    return searchTargets.filter((entry) => {
      if (scope !== "all" && scope !== entry.category) {
        return false;
      }

      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${entry.title} ${entry.description}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, scope, searchTargets]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!canSearchMessages) {
      activeMessageFilterRef.current = null;
      setMessageSearchResults([]);
      setMessageNextCursor(undefined);
      setIsLoadingMore(false);
      setIsSearching(false);
      if (isMessageScopeEnabled && hasMessageFilter && hasConversationId && !hasValidConversationId) {
        setValidationError(localizeText("Đường dẫn cuộc trò chuyện không hợp lệ."));
      } else if (!isMessageScopeEnabled || !hasMessageFilter || !hasConversationId) {
        setValidationError(null);
      }

      if (!hasMessageFilter && scope !== "chat") {
        setSearchError(null);
      }

      return;
    }

    const normalizedFrom = toIsoDate(fromDate);
    const normalizedTo = toIsoDate(toDate);

    if (fromDate && !normalizedFrom) {
      activeMessageFilterRef.current = null;
      setMessageSearchResults([]);
      setMessageNextCursor(undefined);
      setValidationError(localizeText("Ngày không đúng định dạng."));
      setIsSearching(false);
      return;
    }

    if (toDate && !normalizedTo) {
      activeMessageFilterRef.current = null;
      setMessageSearchResults([]);
      setMessageNextCursor(undefined);
      setValidationError(localizeText("Đến ngày không đúng định dạng."));
      setIsSearching(false);
      return;
    }

    if (normalizedFrom && normalizedTo && new Date(normalizedFrom).getTime() > new Date(normalizedTo).getTime()) {
      activeMessageFilterRef.current = null;
      setMessageSearchResults([]);
      setMessageNextCursor(undefined);
      setValidationError(localizeText("Khoảng thời gian không hợp lệ: Ngày bắt đầu phải trước hoặc bằng đến ngày."));
      setIsSearching(false);
      return;
    }

    if (scope === "chat" && hasConversationId && !hasValidConversationId) {
      activeMessageFilterRef.current = null;
      setValidationError(localizeText("Đường dẫn cuộc trò chuyện không hợp lệ."));
      setMessageSearchResults([]);
      setMessageNextCursor(undefined);
      setIsSearching(false);
      return;
    }

    setValidationError(null);
    setSearchError(null);

    const filter: MessageSearchFilters = {
      size: SEARCH_PAGE_SIZE,
      page: 0
    };

    if (query.trim()) {
      filter.content = query.trim();
    }

    if (messageType.trim()) {
      filter.type = messageType;
    }

    if (fromDate.trim()) {
      filter.from = normalizedFrom;
    }

    if (toDate.trim()) {
      filter.to = normalizedTo;
    }

    if (attachmentFilter !== "all") {
      filter.hasAttachment = attachmentFilter === "true";
    }

    if (pinnedFilter !== "all") {
      filter.isPinned = pinnedFilter === "true";
    }

    if (hasConversationId && hasValidConversationId) {
      filter.conversationId = conversationId;
    }

    activeMessageFilterRef.current = filter;
    setMessageNextCursor(undefined);
    setIsLoadingMore(false);

    const controller = new AbortController();

    setIsSearching(true);

    const timeout = window.setTimeout(async () => {
      try {
        const result = await searchMessages(filter, { signal: controller.signal });

        if (requestId !== requestIdRef.current) {
          return;
        }

        const mapped: SearchData[] = result.content.map((message): SearchData => ({
          title: localizeText("Tin nhắn trong cuộc trò chuyện"),
          path: `/app?conversationId=${message.conversationId}&messageId=${message.messageId}`,
          description: message.content,
          category: "chat",
        }));

        setMessageSearchResults(mapped);
        setMessageNextCursor(result.nextCursor);
      } catch (error) {
        if (requestId !== requestIdRef.current || isRequestCanceled(error)) {
          return;
        }
        logger.error("[SearchPage] Failed to search messages", error instanceof Error ? error.message : String(error));
        setMessageSearchResults([]);
        setSearchError(getUserFacingErrorMessage(error, localizeText("Không tìm thấy tin nhắn phù hợp. Vui lòng thử lại.")));
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [
    attachmentFilter,
    canSearchMessages,
    conversationId,
    fromDate,
    hasConversationId,
    hasMessageFilter,
    isMessageScopeEnabled,
    messageType,
    pinnedFilter,
    query,
    hasValidConversationId,
    scope,
    toDate
  ]);

  const loadMoreMessageResults = useCallback(async () => {
    const cursor = messageNextCursor;
    const activeFilter = activeMessageFilterRef.current;
    const requestId = requestIdRef.current;
    if (!cursor || !activeFilter || isLoadingMore || !canSearchMessages) {
      return;
    }

    setIsLoadingMore(true);
    setSearchError(null);
    try {
      const result = await searchMessages({ ...activeFilter, pageCursor: cursor });

      if (requestId !== requestIdRef.current) {
        return;
      }

      const mapped: SearchData[] = result.content.map((message): SearchData => ({
        title: localizeText("Tin nhắn trong cuộc trò chuyện"),
        path: `/app?conversationId=${message.conversationId}&messageId=${message.messageId}`,
        description: message.content,
        category: "chat",
      }));
      setMessageSearchResults((current) => [...current, ...mapped]);
      setMessageNextCursor(result.nextCursor);
    } catch (error) {
      if (requestId !== requestIdRef.current || isRequestCanceled(error)) {
        return;
      }
      logger.error("[SearchPage] Failed to load more messages", error instanceof Error ? error.message : String(error));
      setSearchError(SEARCH_COPY.messageFilter.loadMoreError);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [canSearchMessages, isLoadingMore, messageNextCursor]);

  const results = useMemo(() => {
    if (scope === "chat") {
      return conversationId ? messageSearchResults : [];
    }

    if (scope === "all") {
      return [...messageSearchResults, ...localResults];
    }

    return localResults;
  }, [conversationId, localResults, messageSearchResults, scope]);

  const clearMessageFilters = () => {
    setQuery("");
    setMessageType("");
    setFromDate("");
    setToDate("");
    setAttachmentFilter("all");
    setPinnedFilter("all");
    setSearchError(null);
    setValidationError(null);
    setMessageSearchResults([]);
    setMessageNextCursor(undefined);
    activeMessageFilterRef.current = null;
  };

  return (
    <AppPageShell contentClassName="pb-12">
      <div className="layout-stack">
        <SurfacePanel className="layout-stack">
          <SectionHeader title={SEARCH_COPY.pageTitle} description={SEARCH_COPY.pageDescription} />
          <label className="relative block">
            <span className="sr-only">{SEARCH_COPY.queryLabel}</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={SEARCH_COPY.queryPlaceholder}
              className="focus-ring h-11 w-full rounded-[var(--radius-md)] border border-border bg-background px-4 py-2 pl-10 outline-none"
            />
          </label>

          <div className="mb-2 flex flex-wrap gap-2">
            {scopeFilters.map((item) => (
              <button
                type="button"
                key={item.value}
                onClick={() => setScope(item.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.07em] transition-[color,background-color,border-color,box-shadow,transform,opacity] ${
                  scope === item.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-primary hover:border-primary/50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {isMessageScopeEnabled && (
            <details className="group rounded-lg border border-border/50 bg-background">
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground marker:hidden">
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal size={14} aria-hidden="true" />
                  {localizeText("Bộ lọc tin nhắn")}
                  {messageFilterCount > 0 ? (
                    <span
                      className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-primary"
                      aria-label={localizeText("Số bộ lọc đang bật")}
                    >
                      {messageFilterCount}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70 group-open:hidden">
                  {localizeText("Mở rộng")}
                </span>
              </summary>
              <div className="space-y-3 border-t border-border/40 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5 text-xs">
                  <span className="text-muted-foreground">{SEARCH_COPY.messageFilter.typeLabel}</span>
                  <select
                    value={messageType}
                    onChange={(event) => setMessageType(event.target.value)}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {messageTypeOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="text-muted-foreground">{SEARCH_COPY.messageFilter.attachmentLabel}</span>
                  <select
                    value={attachmentFilter}
                    onChange={(event) => setAttachmentFilter(event.target.value as TriStateFilter)}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {SEARCH_COPY.messageFilter.attachmentOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="text-muted-foreground">{SEARCH_COPY.messageFilter.pinnedLabel}</span>
                  <select
                    value={pinnedFilter}
                    onChange={(event) => setPinnedFilter(event.target.value as TriStateFilter)}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {SEARCH_COPY.messageFilter.pinnedOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="text-muted-foreground">{SEARCH_COPY.messageFilter.fromLabel}</span>
                  <input
                    type="datetime-local"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="text-muted-foreground">{SEARCH_COPY.messageFilter.toLabel}</span>
                  <input
                    type="datetime-local"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={clearMessageFilters}
                    className="rounded-md border border-border/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] hover:bg-muted"
                  >
                    {SEARCH_COPY.messageFilter.clearLabel}
                  </button>
                </div>

                {isMessageScopeEnabled && hasMessageFilter && !hasConversationId ? (
                  <p className="text-xs text-destructive">{SEARCH_COPY.messageFilter.disabledHint}</p>
                ) : null}
              </div>
            </details>
          )}
        </SurfacePanel>

        <SurfacePanel className="surface-elevated layout-stack">
          <SectionHeader
            title={SEARCH_COPY.resultTitlePrefix(results.length)}
            description={
              query.trim()
                ? SEARCH_COPY.resultDescriptionWithQuery(results.length, query)
                : SEARCH_COPY.resultDescriptionDefault
            }
          />
          {scope !== "friends" && isSearching ? (
            <SearchResultSkeleton itemCount={SEARCH_COPY.loadingRowCount} />
          ) : (
            <motion.ul
              className="layout-stack"
              initial={UI_MOTION_CONFIG.initialState}
              animate={UI_MOTION_CONFIG.animateState}
              variants={UI_MOTION_VARIANTS.panelReveal}
            >
              {validationError ? (
                <li className="rounded-lg border border-dashed border-destructive/70 bg-destructive/10 p-3 text-xs text-destructive">
                  {validationError}
                </li>
              ) : null}

              {searchError ? (
                <li className="rounded-lg border border-dashed border-destructive/70 bg-destructive/10 p-3 text-xs text-destructive">
                  {searchError}
                </li>
              ) : null}

              {scope === "chat" && hasConversationId && messageSearchResults.length === 0 && hasMessageFilter ? (
                <li className="rounded-lg border border-dashed border-border/50 bg-background p-3 text-xs text-muted-foreground">
                  {localizeText("Không tìm thấy tin nhắn phù hợp.")}
                </li>
              ) : null}

              {(!hasConversationId && isMessageScopeEnabled && hasMessageFilter) ? (
                <li className="rounded-lg border border-dashed border-border/50 bg-background p-3 text-xs text-muted-foreground">
                  {SEARCH_COPY.messageFilter.disabledHint}
                </li>
              ) : null}

              {results.length === 0 ? (
                <li className="rounded-lg border border-dashed border-border/50 bg-background p-6 text-center text-sm text-muted-foreground">
                  {SEARCH_COPY.emptyMessage}
                </li>
              ) : (
                results.map((item) => (
                  <SearchResultItem
                    key={`${item.path}-${item.title}`}
                    title={item.title}
                    path={item.path}
                    description={item.description}
                    category={item.category}
                    activeQuery={query}
                  />
                ))
              )}

              {messageNextCursor && canSearchMessages && results.length > 0 ? (
                <li className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => void loadMoreMessageResults()}
                    disabled={isLoadingMore}
                    className="focus-ring rounded-full border border-border/60 px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoadingMore ? SEARCH_COPY.messageFilter.loadingMoreLabel : SEARCH_COPY.messageFilter.loadMoreLabel}
                  </button>
                </li>
              ) : null}
            </motion.ul>
          )}
        </SurfacePanel>
      </div>
    </AppPageShell>
  );
};

export default SearchPage;


