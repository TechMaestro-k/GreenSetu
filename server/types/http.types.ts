export interface HttpRequest<TBody = unknown, TParams = Record<string, string>> {
    body: TBody;
    params?: TParams;
    headers?: Record<string, string | string[] | undefined>;
    method?: string;
    url?: string;
}

export interface HttpResponse<TBody = unknown> {
    status: number;
    body: TBody;
    headers?: Record<string, string>;
}
