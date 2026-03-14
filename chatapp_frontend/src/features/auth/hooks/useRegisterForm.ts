import { useState } from 'react';
import { useRegister } from './useRegister';

export const useRegisterForm = () => {
    const [display_name, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const { handleRegister, loading, error } = useRegister();

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void handleRegister({ display_name, username, password });
    };

    return {
        display_name,
        setDisplayName,
        username,
        setUsername,
        password,
        setPassword,
        onSubmit,
        loading,
        error
    };
};
