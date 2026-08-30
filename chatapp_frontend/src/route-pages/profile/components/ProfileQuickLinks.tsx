import Link from "next/link";
import { MessageCircle, Search, Users } from "lucide-react";
import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizeText } from "@/shared/i18n";

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
];

export const ProfileQuickLinks = () => {
  return (
    <section className="border-b border-border py-6 md:pl-8">
      <p className="page-kicker">
        {localizeText(UI_COPY.profile.quickLinksTitle)}
      </p>
      <div className="mt-4 divide-y divide-border border-y border-border">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              href={link.to}
              className="focus-ring flex items-center justify-between gap-3 py-3 text-sm font-semibold transition-colors hover:text-primary"
            >
              <span className="inline-flex items-center gap-2">
                <Icon size={16} />
                {localizeText(link.label)}
              </span><span aria-hidden="true">↗</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default ProfileQuickLinks;
