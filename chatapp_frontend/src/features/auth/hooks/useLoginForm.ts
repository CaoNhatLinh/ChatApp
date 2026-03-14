import { useState } from 'react';
import { useLogin } from './useLogin';

export const useLoginForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const { handleLogin, loading, error } = useLogin();

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void handleLogin({ username, password });
    };

    return {
        username,
        setUsername,
        password,
        setPassword,
        showPassword,
        setShowPassword,
        onSubmit,
        loading,
        error
    };
};
