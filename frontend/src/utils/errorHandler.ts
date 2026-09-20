import type { ApiErrorResponse } from '@/types/api.types';
import type { AxiosError } from 'axios';

export interface ParsedError {
    code: string;
    message: string;
    statusCode: number;
}

const isAxiosError = (error: unknown): error is AxiosError => {
    return (typeof error === 'object' && error !== null && 'isAxiosError' in error && (error as AxiosError).isAxiosError === true);
};

export const parseError = (error: unknown): ParsedError => {
    // Axios error with response data
    if (isAxiosError(error) && error.response) {
        const data = error.response.data as ApiErrorResponse;

        return {
            code: data.code,
            message: data.message ?? 'Something went wrong',
            statusCode: error.response.status,
        };
    }

    // Axios error without response data (e.g., network error)
    if (isAxiosError(error) && !error.response) {
        return {
            code: 'UNKNOWN_ERROR',
            message: 'Network error occurred',
            statusCode: 500,
        };
    }

    // Unknown/unexpected error
    return {
        code: 'UNKNOWN_ERROR',
        message:
            error instanceof Error ? error.message : "An unexpected error occurred.",
        statusCode: 500,
    };
};