import axios from "axios";

export function createApiClient(
    baseURL: string,
    accessToken: string
) {
    return axios.create({
        baseURL,
        timeout: 5000,
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
}

