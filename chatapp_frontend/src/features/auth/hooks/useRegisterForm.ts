import { useState } from 'react';
import { useRegister } from './useRegister';

export const useRegisterForm = () => {
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const { handleRegister, loading, error } = useRegister();

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void handleRegister({ displayName, username, email, password });
    };

    return {
        displayName,
        setDisplayName,
        username,
        setUsername,
        email,
        setEmail,
        password,
        setPassword,
        onSubmit,
        loading,
        error
    };
};
