import { useState, type FormEvent } from 'react';
import { useFriendStore } from '@/features/relationships/model/friend.store'; // Adjust the import path as necessary

const UserSearch = () => {
  const [username, setUsername] = useState('');
  const { searchUsers, error } = useFriendStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    try {
      await searchUsers(username);
      setUsername('');
    } catch (err) {
      console.error('Search failed:', err instanceof Error ? err.message : err);
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };
  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="mb-4">
        <input
          type="text"
          value={username}
          onChange={handleInputChange}
          placeholder="Nhập tên người dùng"
          className="w-full p-2 border border-gray-800 rounded text-sm mb-2 text-gray-300 focus:outline-none focus:border-blue-500 bg-gray-700 placeholder-gray-400"
        />
        <button type="submit" className="w-full bg-blue-500 hover:bg-blue-700 ext-gray-300 py-2 px-4 rounded text-sm font-medium transition-colors">
          Tìm kiếm
        </button>
      </div>

      {error && <p className="text-red-500 mt-2">{error}</p>}
    </form>
  );
};

export default UserSearch;