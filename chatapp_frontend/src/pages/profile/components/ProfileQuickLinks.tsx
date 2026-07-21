import { Link } from "react-router-dom";
import { MessageCircle, Search, Settings, Users, Activity } from "lucide-react";
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
  {
    to: "/activity",
    icon: Activity,
    label: UI_COPY.profile.quickLinkItems.activity,
  },
];

export const ProfileQuickLinks = () => {
  return (
    <section className="surface p-6 border border-border/65">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
        {UI_COPY.profile.quickLinksTitle}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 text-sm font-semibold hover:bg-card"
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
