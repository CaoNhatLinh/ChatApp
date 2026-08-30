import { toast } from 'react-hot-toast';

type ToastOptions = Parameters<typeof toast>[1];
const FEEDBACK_TOAST_ID = 'novachat-feedback';
const ERROR_TOAST_ID = 'novachat-error';

export const notifySuccess = (message: string, options?: ToastOptions): void => {
  toast.success(message, { ...options, id: FEEDBACK_TOAST_ID });
};

export const notifyError = (message: string, options?: ToastOptions): void => {
  toast.error(message, { ...options, id: ERROR_TOAST_ID });
};

export const notifyWarning = (message: string, options?: ToastOptions): void => {
  toast(message, {
    ...options,
    id: FEEDBACK_TOAST_ID,
    icon: '\u26A0',
  });
};

export const dismissFeedback = (): void => {
  toast.remove(FEEDBACK_TOAST_ID);
};
