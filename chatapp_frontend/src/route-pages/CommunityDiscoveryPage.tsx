'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Compass, Filter, Search, UsersRound } from 'lucide-react';
import { AppPageShell } from '@/route-pages/shared/AppPageShell';
import {
  joinCommunity,
  listCommunities,
  type CommunitySummary,
} from '@/features/communities/api/community.api';
import { useAppLocale, localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';
import { Avatar, AvatarFallback, AvatarImage, DefaultUserAvatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Input } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';

const PAGE_SIZE = 24;
const SEARCH_DELAY_MS = 300;

export const CommunityDiscoveryPage = () => {
  const { locale } = useAppLocale();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [selectedTag, setSelectedTag] = useState<string>();
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [busyCommunityId, setBusyCommunityId] = useState<string>();
  const requestIdRef = useRef(0);

  const load = useCallback(async (cursor?: string) => {
    const requestId = ++requestIdRef.current;
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(undefined);
    try {
      const page = await listCommunities({
        languageCode: locale,
        query: query.trim() || undefined,
        categoryId: selectedCategory,
        tag: selectedTag,
        cursor,
        limit: PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;
      setCommunities((current) => cursor ? [...current, ...page.content] : page.content);
      setNextCursor(page.nextCursor ?? undefined);
      setHasNext(page.hasNext);
    } catch (loadError: unknown) {
      if (requestId !== requestIdRef.current) return;
      logger.error('[CommunityDiscovery] Failed to load communities', loadError instanceof Error ? loadError.message : String(loadError));
      setError(getUserFacingErrorMessage(loadError, localizeText('Không thể tải danh sách cộng đồng.')));
      if (!cursor) setCommunities([]);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [locale, query, selectedCategory, selectedTag]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const visibleTags = useMemo(
    () => Array.from(new Set(communities.flatMap((community) => community.communityTags))).slice(0, 8),
    [communities],
  );
  const visibleCategories = useMemo(
    () => Array.from(new Set(communities
      .map((community) => community.categoryId)
      .filter((category): category is string => Boolean(category)))).slice(0, 6),
    [communities],
  );

  const handleJoin = async (community: CommunitySummary) => {
    setBusyCommunityId(community.conversationId);
    setError(undefined);
    try {
      const result = await joinCommunity(community.conversationId);
      if (result.status === 'CAPACITY_REACHED') {
        setError(localizeText('Cộng đồng đã đủ thành viên.'));
        return;
      }
      if (result.status === 'RETRY_REQUIRED') {
        setError(localizeText('Trạng thái tham gia vừa thay đổi. Vui lòng thử lại.'));
        return;
      }
      const membershipStatus = result.status === 'PENDING' ? 'PENDING' : 'JOINED';
      setCommunities((current) => current.map((item) => item.conversationId === community.conversationId
        ? { ...item, membershipStatus }
        : item));
    } catch (joinError: unknown) {
      logger.error('[CommunityDiscovery] Failed to join community', joinError instanceof Error ? joinError.message : String(joinError));
      setError(getUserFacingErrorMessage(joinError, localizeText('Không thể tham gia cộng đồng.')));
    } finally {
      setBusyCommunityId(undefined);
    }
  };

  return (
    <AppPageShell>
      <section className="border-b border-border pb-8 pt-3 sm:pb-10">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="page-kicker">{localizeText('Khám phá cộng đồng')}</p>
            <h1 className="max-w-[13ch] text-balance text-4xl font-bold tracking-[-0.05em] sm:text-5xl">{localizeText('Tìm một cuộc trò chuyện có chung mối quan tâm.')}</h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{localizeText('Xem mục đích, quy mô và cách tham gia trước khi bạn gửi yêu cầu.')}</p>
          </div>
          <div className="hidden border-l border-border pl-6 lg:block">
            <p className="text-sm font-semibold">{localizeText('Tham gia có chủ đích')}</p>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{localizeText('Nối không tự đưa bạn vào một không gian. Bạn luôn biết điều gì sẽ xảy ra tiếp theo.')}</p>
          </div>
        </div>
      </section>

      <section className="mt-7" aria-labelledby="community-results-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="page-kicker">{localizeText('Danh mục cộng đồng')}</p>
            <h2 id="community-results-title" className="text-2xl font-semibold tracking-tight">{localizeText('Khám phá theo tên hoặc chủ đề')}</h2>
          </div>
          <label className="relative block w-full lg:max-w-md">
            <span className="sr-only">{localizeText('Tìm cộng đồng')}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={localizeText('Tìm theo tên cộng đồng...')} className="pl-10" />
          </label>
        </div>

        {selectedCategory || selectedTag || visibleCategories.length > 0 || visibleTags.length > 0 ? (
          <details className="group mt-5 border-y border-border py-3">
            <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-sm)] text-sm font-semibold marker:hidden">
              <span className="flex items-center gap-2"><Filter size={16} aria-hidden="true" />{localizeText('Bộ lọc')}</span>
              <span className="flex items-center gap-3 text-xs font-medium text-muted-foreground">{selectedCategory || selectedTag ? localizeText('Đang áp dụng') : localizeText('Tất cả cộng đồng')}<ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" /></span>
            </summary>
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label={localizeText('Lọc theo danh mục')}>
              <button type="button" onClick={() => { setSelectedCategory(undefined); setSelectedTag(undefined); }} className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${!selectedCategory && !selectedTag ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>{localizeText('Tất cả')}</button>
              {(selectedCategory && !visibleCategories.includes(selectedCategory) ? [selectedCategory, ...visibleCategories] : visibleCategories).map((category) => (
                <button key={category} type="button" onClick={() => { setSelectedCategory(category); setSelectedTag(undefined); }} className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedCategory === category ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>{category}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={localizeText('Lọc theo chủ đề')}>
            {(selectedTag && !visibleTags.includes(selectedTag) ? [selectedTag, ...visibleTags] : visibleTags).map((tag) => (
              <button key={tag} type="button" onClick={() => { setSelectedTag(tag); setSelectedCategory(undefined); }} className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedTag === tag ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50'}`}>#{tag}</button>
            ))}
            </div>
            </div>
          </details>
        ) : null}

        {error ? <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</div> : null}

        {loading ? (
          <div className="mt-6 space-y-3" aria-label={localizeText('Đang tải cộng đồng...')}>
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-[var(--radius-md)]" />)}
          </div>
        ) : communities.length === 0 ? (
          <div className="mt-6 product-surface"><EmptyState icon={<Compass size={22} />} title={localizeText('Chưa tìm thấy cộng đồng phù hợp')} description={localizeText('Thử từ khóa khác hoặc bỏ bộ lọc chủ đề để xem thêm kết quả.')} action={<Button type="button" variant="outline" onClick={() => { setQuery(''); setSelectedCategory(undefined); setSelectedTag(undefined); }}>{localizeText('Xóa bộ lọc')}</Button>} /></div>
        ) : (
          <div className="mt-6 divide-y divide-border border-y border-border">
            {communities.map((community) => {
              const isJoined = community.membershipStatus === 'JOINED';
              const isPending = community.membershipStatus === 'PENDING';
              const isFull = community.memberCount >= community.maxMembers;
              return (
                <article key={community.conversationId} className="group grid gap-4 py-5 sm:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
                  <div className="flex items-start gap-4 sm:contents">
                    <Avatar className="h-12 w-12 rounded-xl border border-border">
                      {community.avatarUrl ? <AvatarImage src={community.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="rounded-xl bg-accent p-0">
                        <DefaultUserAvatar alt={localizeText('Ảnh đại diện mặc định')} />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 sm:col-start-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="text-lg font-semibold tracking-[-0.02em]">{community.name}</h3>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><UsersRound size={13} aria-hidden="true" />{new Intl.NumberFormat(locale).format(community.memberCount)}</span>
                        {community.joinPolicy === 'REQUEST_APPROVAL' ? <span className="text-xs text-muted-foreground">{localizeText('Cần phê duyệt')}</span> : null}
                      </div>
                      <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm leading-6 text-muted-foreground">{community.description || localizeText('Cộng đồng đang chuẩn bị phần giới thiệu.')}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{community.categoryId ? community.categoryId : localizeText('Chủ đề mở')}{community.communityTags.length > 0 ? ` · ${localizeText('Có')} ${community.communityTags.length} ${localizeText('chủ đề')}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center sm:col-start-3 sm:row-start-1 sm:row-span-2 sm:justify-end">
                    {isJoined ? (
                      <Button asChild size="sm"><Link href={`/app?conversationId=${encodeURIComponent(community.conversationId)}`}>{localizeText('Mở phòng')}<ArrowRight size={14} aria-hidden="true" /></Link></Button>
                    ) : (
                      <Button type="button" size="sm" variant={isPending ? 'outline' : 'default'} loading={busyCommunityId === community.conversationId} disabled={isPending || isFull} onClick={() => void handleJoin(community)}>
                        {isPending ? localizeText('Đang chờ duyệt') : isFull ? localizeText('Đã đủ thành viên') : community.joinPolicy === 'REQUEST_APPROVAL' ? localizeText('Gửi yêu cầu') : localizeText('Vào cộng đồng')}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {hasNext && nextCursor ? <div className="mt-8 flex justify-center"><Button type="button" variant="outline" loading={loadingMore} onClick={() => void load(nextCursor)}>{localizeText('Xem thêm cộng đồng')}</Button></div> : null}
      </section>
    </AppPageShell>
  );
};

export default CommunityDiscoveryPage;
