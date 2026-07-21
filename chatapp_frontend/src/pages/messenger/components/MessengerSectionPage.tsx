import { useEffect } from 'react';
import { useMessenger } from '@/features/messenger/model/useMessenger';
import { MessengerPage } from '@/pages/MessengerPage';

interface MessengerSectionPageProps {
  view: 'chat' | 'contacts';
}

export const MessengerSectionPage = ({ view }: MessengerSectionPageProps) => {
  const { activeView, setActiveView } = useMessenger();

  useEffect(() => {
    if (activeView !== view) {
      setActiveView(view);
    }
  }, [activeView, setActiveView, view]);

  return <MessengerPage />;
};

export default MessengerSectionPage;

