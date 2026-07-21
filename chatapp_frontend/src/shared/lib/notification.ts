import { toast } from 'react-hot-toast';

type ToastOptions = Parameters<typeof toast>[1];

export const notifySuccess = (message: string, options?: ToastOptions): void => {
  toast.success(message, options);
};

export const notifyError = (message: string, options?: ToastOptions): void => {
  toast.error(message, options);
};

export const notifyWarning = (message: string, options?: ToastOptions): void => {
  toast(message, {
    icon: '\u26A0',
    ...options,
  });
};
