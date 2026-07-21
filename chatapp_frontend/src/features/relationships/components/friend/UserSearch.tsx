import { useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { notifyWarning } from '@/shared/lib/notification';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';
import { useFriendStore } from '@/features/relationships/model/friend.store';

const MIN_QUERY_LENGTH = 3;

const UserSearch = () => {
  const [username, setUsername] = useState('');
  const searchUsers = useFriendStore((state) => state.searchUsers);
  const searchError = useFriendStore((state) => state.error);
  const loadingSearch = useFriendStore((state) => state.loadingSearch);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = username.trim();

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      notifyWarning(`Nhập ít nhất ${MIN_QUERY_LENGTH} ký tự để tìm.`);
      return;
    }

    await searchUsers(trimmedQuery);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="mb-4 space-y-2"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={username}
          onChange={handleInputChange}
          placeholder="Nhập tên người dùng"
          className="pl-9"
        />
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loadingSearch}
      >
        {loadingSearch ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Đang tìm
          </span>
        ) : (
          'Tìm kiếm'
        )}
      </Button>

      {searchError && <p className="text-sm text-destructive mt-2">{searchError}</p>}
    </motion.form>
  );
};

export default UserSearch;
