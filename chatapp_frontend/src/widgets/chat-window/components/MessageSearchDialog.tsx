import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/Dialog";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";
import {
  searchMessages,
  type MessageSearchFilters,
  type MessageSearchResult,
} from "@/features/messenger/api/messenger.api";
import { MESSENGER_COPY } from "@/features/messenger/constants/messengerCopy";
import { getLocale, localizeText, useAppLocale } from "@/shared/i18n";
import { getUserFacingErrorMessage } from "@/shared/lib/user-facing-error";
import { logger } from "@/shared/lib/logger";

type TriStateFilter = "all" | "true" | "false";

interface MessageSearchDialogProps {
  isOpen: boolean;
  conversationId: string;
  conversationName: string;
  onClose: () => void;
  onSelectMessage: (messageId: string) => void;
}

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

const toIsoDate = (value: string) => {
  if (!value) return "";
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "" : new Date(parsed).toISOString();
};

const isRequestCanceled = (error: unknown) => {
  if (error instanceof DOMException) return error.name === "AbortError";
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return record.name === "CanceledError" || record.code === "ERR_CANCELED";
};

const formatMessageDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(getLocale() === "en" ? "en-US" : "vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export const MessageSearchDialog = ({
  isOpen,
  conversationId,
  conversationName,
  onClose,
  onSelectMessage,
}: MessageSearchDialogProps) => {
  const { locale } = useAppLocale();
  const [query, setQuery] = useState("");
  const [messageType, setMessageType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [attachmentFilter, setAttachmentFilter] = useState<TriStateFilter>("all");
  const [pinnedFilter, setPinnedFilter] = useState<TriStateFilter>("all");
  const [results, setResults] = useState<MessageSearchResult[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeFilterRef = useRef<MessageSearchFilters | null>(null);

  const hasCriteria = Boolean(
    query.trim() ||
      messageType ||
      fromDate ||
      toDate ||
      attachmentFilter !== "all" ||
      pinnedFilter !== "all",
  );

  const resetSearch = useCallback(() => {
    setQuery("");
    setMessageType("");
    setFromDate("");
    setToDate("");
    setAttachmentFilter("all");
    setPinnedFilter("all");
    setResults([]);
    setNextCursor(undefined);
    setErrorMessage(null);
    setValidationMessage(null);
    setIsSearching(false);
    setIsLoadingMore(false);
    activeFilterRef.current = null;
  }, []);

  useEffect(() => {
    if (isOpen) return;
    resetSearch();
  }, [isOpen, resetSearch]);

  useEffect(() => {
    if (!isOpen || !hasCriteria) {
      setResults([]);
      setNextCursor(undefined);
      setErrorMessage(null);
      setValidationMessage(null);
      setIsSearching(false);
      activeFilterRef.current = null;
      return;
    }

    const from = toIsoDate(fromDate);
    const to = toIsoDate(toDate);
    if ((fromDate && !from) || (toDate && !to)) {
      setValidationMessage(localizeText("Ngày không đúng định dạng."));
      setResults([]);
      setNextCursor(undefined);
      return;
    }
    if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
      setValidationMessage(localizeText("Khoảng thời gian không hợp lệ: Ngày bắt đầu phải trước hoặc bằng đến ngày."));
      setResults([]);
      setNextCursor(undefined);
      return;
    }

    const filter: MessageSearchFilters = {
      conversationId,
      size: PAGE_SIZE,
      content: query.trim() || undefined,
      type: messageType || undefined,
      from: from || undefined,
      to: to || undefined,
      hasAttachment: attachmentFilter === "all" ? undefined : attachmentFilter === "true",
      isPinned: pinnedFilter === "all" ? undefined : pinnedFilter === "true",
    };
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    activeFilterRef.current = filter;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setErrorMessage(null);
      setValidationMessage(null);
      try {
        const response = await searchMessages(filter, { signal: controller.signal });
        if (requestId !== requestIdRef.current) return;
        setResults(response.content);
        setNextCursor(response.nextCursor);
      } catch (error) {
        if (requestId !== requestIdRef.current || isRequestCanceled(error)) return;
        logger.error("[MessageSearchDialog] Failed to search messages", error instanceof Error ? error.message : String(error));
        setResults([]);
        setErrorMessage(getUserFacingErrorMessage(error, localizeText("Không tìm thấy tin nhắn phù hợp. Vui lòng thử lại.")));
      } finally {
        if (requestId === requestIdRef.current) setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attachmentFilter, conversationId, fromDate, hasCriteria, isOpen, messageType, pinnedFilter, query, toDate, locale]);

  const loadMore = useCallback(async () => {
    const cursor = nextCursor;
    const filter = activeFilterRef.current;
    if (!cursor || !filter || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const response = await searchMessages({ ...filter, pageCursor: cursor });
      setResults((current) => [...current, ...response.content]);
      setNextCursor(response.nextCursor);
    } catch (error) {
      logger.error("[MessageSearchDialog] Failed to load more messages", error instanceof Error ? error.message : String(error));
      setErrorMessage(getUserFacingErrorMessage(error, MESSENGER_COPY.search.messageFilter.loadMoreError));
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor]);

  const clearFilters = () => {
    setQuery("");
    setMessageType("");
    setFromDate("");
    setToDate("");
    setAttachmentFilter("all");
    setPinnedFilter("all");
    setErrorMessage(null);
    setValidationMessage(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="overflow-y-auto border-0 bg-background sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:border-border">
        <DialogHeader>
          <DialogTitle>{localizeText("Tìm tin nhắn")}</DialogTitle>
          <DialogDescription>
            {localizeText("Tìm trong")} <span className="font-medium text-foreground">{conversationName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="relative block">
            <span className="sr-only">{localizeText("Từ khóa tin nhắn")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={localizeText("Tìm nội dung tin nhắn...")}
              className="focus-ring h-11 w-full rounded-[var(--radius-md)] border border-border bg-card px-4 py-2 pl-10 outline-none"
            />
          </label>

          <details className="group rounded-[var(--radius-md)] border border-border bg-card">
            <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium marker:hidden">
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal size={15} aria-hidden="true" />
                {localizeText("Bộ lọc tin nhắn")}
              </span>
              <span className="text-xs text-muted-foreground">{localizeText("Tùy chọn")}</span>
            </summary>
            <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs">
                <span className="text-muted-foreground">{localizeText(MESSENGER_COPY.search.messageFilter.typeLabel)}</span>
                <Select value={messageType} onChange={(event) => setMessageType(event.target.value)}>
                  {MESSENGER_COPY.search.messageFilter.messageTypeOptions.map((option) => <option key={option.value} value={option.value}>{localizeText(option.label)}</option>)}
                </Select>
              </label>
              <label className="space-y-1.5 text-xs">
                <span className="text-muted-foreground">{localizeText(MESSENGER_COPY.search.messageFilter.attachmentLabel)}</span>
                <Select value={attachmentFilter} onChange={(event) => setAttachmentFilter(event.target.value as TriStateFilter)}>
                  {MESSENGER_COPY.search.messageFilter.attachmentOptions.map((option) => <option key={option.value} value={option.value}>{localizeText(option.label)}</option>)}
                </Select>
              </label>
              <label className="space-y-1.5 text-xs">
                <span className="text-muted-foreground">{localizeText(MESSENGER_COPY.search.messageFilter.pinnedLabel)}</span>
                <Select value={pinnedFilter} onChange={(event) => setPinnedFilter(event.target.value as TriStateFilter)}>
                  {MESSENGER_COPY.search.messageFilter.pinnedOptions.map((option) => <option key={option.value} value={option.value}>{localizeText(option.label)}</option>)}
                </Select>
              </label>
              <label className="space-y-1.5 text-xs">
                <span className="text-muted-foreground">{localizeText(MESSENGER_COPY.search.messageFilter.fromLabel)}</span>
                <Input type="datetime-local" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </label>
              <label className="space-y-1.5 text-xs">
                <span className="text-muted-foreground">{localizeText(MESSENGER_COPY.search.messageFilter.toLabel)}</span>
                <Input type="datetime-local" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </label>
              <div className="flex items-end sm:col-span-2">
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>{localizeText(MESSENGER_COPY.search.messageFilter.clearLabel)}</Button>
              </div>
            </div>
          </details>

          {validationMessage ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{validationMessage}</p> : null}
          {errorMessage ? <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{errorMessage}</p> : null}

          <div className="space-y-2" aria-live="polite">
            {!hasCriteria ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{localizeText("Nhập từ khóa hoặc chọn bộ lọc để tìm tin nhắn.")}</p>
            ) : isSearching ? (
              <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{localizeText("Đang tìm...")}</div>
            ) : results.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{localizeText(MESSENGER_COPY.search.messageFilter.emptyMessage)}</p>
            ) : (
              results.map((result) => (
                <button
                  key={result.messageId}
                  type="button"
                  onClick={() => { onSelectMessage(result.messageId); onClose(); }}
                  className="focus-ring block w-full rounded-md border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/60 hover:bg-accent"
                >
                  <span className="line-clamp-3 block text-sm text-foreground">{result.content}</span>
                  {result.createdAt ? <span className="mt-1 block text-xs text-muted-foreground">{formatMessageDate(result.createdAt)}</span> : null}
                </button>
              ))
            )}
          </div>

          {nextCursor && results.length > 0 ? <div className="flex justify-center"><Button type="button" variant="outline" size="sm" onClick={() => void loadMore()} loading={isLoadingMore}>{localizeText(MESSENGER_COPY.search.messageFilter.loadMoreLabel)}</Button></div> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MessageSearchDialog;
