import { UI_COPY } from "@/shared/constants/ui-copy";
import { localizedCopy } from "@/shared/i18n";

const rawProfileCopy = {
  loading: UI_COPY.profile.loading,
} as const;

export const PROFILE_COPY = localizedCopy(rawProfileCopy);
