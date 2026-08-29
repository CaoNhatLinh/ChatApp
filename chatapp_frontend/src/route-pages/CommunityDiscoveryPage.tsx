'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Compass, Hash, Search, UsersRound } from 'lucide-react';
import { AppPageShell } from '@/route-pages/shared/AppPageShell';
import {
  joinCommunity,
  listCommunities,
  type CommunitySummary,
} from '@/features/communities/api/community.api';
import { useAppLocale, localizeText } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Input } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';

const PAGE_SIZE = 24;
const SEARCH_DELAY_MS = 300;

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase();

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
      <section className="relative overflow-hidden rounded-[1.4rem] border border-border bg-foreground px-6 py-8 text-background sm:px-9 sm:py-10">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/35 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">{localizeText('Khám phá cộng đồng')}</p>
            <h1 className="text-balance text-3xl font-bold tracking-[-0.04em] sm:text-5xl">{localizeText('Tìm nơi dành cho điều bạn quan tâm.')}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-background/70 sm:text-base">{localizeText('Gặp gỡ những người cùng sở thích, tham gia cuộc trò chuyện công khai và xây dựng cộng đồng của bạn.')}</p>
          </div>
          <div className="rounded-2xl border border-background/15 bg-background/8 p-5 backdrop-blur">
            <Compass className="mb-6 text-primary" size={28} aria-hidden="true" />
            <p className="text-sm font-semibold">{localizeText('Cộng đồng mở, thông tin rõ ràng')}</p>
            <p className="mt-2 text-xs leading-5 text-background/60">{localizeText('Mỗi cộng đồng hiển thị chính sách tham gia và sức chứa trước khi bạn quyết định.')}</p>
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="community-results-title">
        <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
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
          <div className="mt-4 space-y-2.5">
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
        ) : null}

        {error ? <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">{error}</div> : null}

        {loading ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={localizeText('Đang tải cộng đồng...')}>
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-64 rounded-2xl" />)}
          </div>
        ) : communities.length === 0 ? (
          <div className="mt-6 product-surface"><EmptyState icon={<Compass size={22} />} title={localizeText('Chưa tìm thấy cộng đồng phù hợp')} description={localizeText('Thử từ khóa khác hoặc bỏ bộ lọc chủ đề để xem thêm kết quả.')} action={<Button type="button" variant="outline" onClick={() => { setQuery(''); setSelectedCategory(undefined); setSelectedTag(undefined); }}>{localizeText('Xóa bộ lọc')}</Button>} /></div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {communities.map((community) => {
              const isJoined = community.membershipStatus === 'JOINED';
              const isPending = community.membershipStatus === 'PENDING';
              const isFull = community.memberCount >= community.maxMembers;
              return (
                <article key={community.conversationId} className="group flex min-h-64 flex-col rounded-2xl border border-border bg-card p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/45">
                  <div className="flex items-start justify-between gap-4">
                    <Avatar className="h-12 w-12 rounded-xl border border-border">
                      {community.avatarUrl ? <AvatarImage src={community.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="rounded-xl bg-accent font-bold text-accent-foreground">{initials(community.name)}</AvatarFallback>
                    </Avatar>
                    <Badge variant="outline" className="gap-1"><UsersRound size={12} aria-hidden="true" />{new Intl.NumberFormat(locale).format(community.memberCount)}</Badge>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{community.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{community.description || localizeText('Cộng đồng đang chuẩn bị phần giới thiệu.')}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {community.categoryId ? <button type="button" onClick={() => { setSelectedCategory(community.categoryId ?? undefined); setSelectedTag(undefined); }} aria-label={`${localizeText('Lọc theo danh mục')}: ${community.categoryId}`}><Badge variant="secondary">{community.categoryId}</Badge></button> : null}
                    {community.communityTags.slice(0, 3).map((tag) => <Badge key={tag} variant="outline" className="gap-1"><Hash size={10} aria-hidden="true" />{tag}</Badge>)}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
                    <span className="text-xs font-medium text-muted-foreground">{community.joinPolicy === 'REQUEST_APPROVAL' ? localizeText('Cần phê duyệt') : localizeText('Tham gia ngay')}</span>
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
