import axios from 'axios';

export class ErrorPresenter {
  static message(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data as { message?: string | string[] } | undefined;
      if (Array.isArray(detail?.message)) {
        return detail.message.join(', ');
      }
      return detail?.message ?? error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Something went wrong. Please try again.';
  }
}
