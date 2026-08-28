import Link from "next/link";
import { MessageCircle, Search, Settings, Users } from "lucide-react";
import { UI_COPY } from "@/shared/constants/ui-copy";

const quickLinks = [
  {
    to: "/app",
    icon: MessageCircle,
    label: UI_COPY.profile.quickLinkItems.app,
  },
  {
    to: "/search",
    icon: Search,
    label: UI_COPY.profile.quickLinkItems.search,
  },
  {
    to: "/friends",
    icon: Users,
    label: UI_COPY.profile.quickLinkItems.friends,
  },
  {
    to: "/settings?tab=appearance",
    icon: Settings,
    label: UI_COPY.profile.quickLinkItems.settings,
  },
];

export const ProfileQuickLinks = () => {
  return (
    <section className="product-surface p-6">
      <p className="page-kicker">
        {UI_COPY.profile.quickLinksTitle}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              href={link.to}
              className="focus-ring inline-flex items-center justify-between rounded-[var(--radius-md)] border border-border px-4 py-3 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              <span className="inline-flex items-center gap-2">
                <Icon size={16} />
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default ProfileQuickLinks;
