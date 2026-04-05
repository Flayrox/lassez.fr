
export const WP_API_URL = 'https://api.lassez.fr/wp-json/wp/v2';

export const fetcher = async (url: string) => {
    const res = await fetch(url);

    if (!res.ok) {
        const error: any = new Error('An error occurred while fetching the data.');
        error.info = await res.json();
        error.status = res.status;
        throw error;
    }

    return res.json();
};
