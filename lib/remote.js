function schema(validate) {
    return { parse: validate };
}
function strict(name, validate) {
    return { mode: 'strict', typeSymbol: name, create: () => schema(validate) };
}
function object(value, name) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new TypeError(`${name} must be an object`);
    }
    return value;
}
function string(value, name = 'value') {
    if (typeof value !== 'string')
        throw new TypeError(`${name} must be a string`);
    return value;
}
function boolean(value, name = 'value') {
    if (typeof value !== 'boolean')
        throw new TypeError(`${name} must be a boolean`);
    return value;
}
function authorizationEntry(value) {
    const row = object(value, 'authorization entry');
    const methods = row['methods'];
    if (!Array.isArray(methods))
        throw new TypeError('authorization entry methods must be an array');
    const kind = row['credentialKind'];
    if (kind !== undefined && kind !== 'api-key' && kind !== 'grant') {
        throw new TypeError('authorization credentialKind is invalid');
    }
    return {
        key: string(row['key'], 'authorization entry key'),
        label: string(row['label'], 'authorization entry label'),
        methods: methods.map((method) => {
            const item = object(method, 'authorization method');
            return { id: string(item['id'], 'method id'), label: string(item['label'], 'method label') };
        }),
        inFlight: boolean(row['inFlight'], 'authorization entry inFlight'),
        configured: boolean(row['configured'], 'authorization entry configured'),
        ...(kind === undefined ? {} : { credentialKind: kind }),
    };
}
function authorizationEntries(value) {
    if (!Array.isArray(value))
        throw new TypeError('authorization entries must be an array');
    return value.map(authorizationEntry);
}
function authorizationFrame(value) {
    const frame = object(value, 'authorization frame');
    const type = string(frame['type'], 'authorization frame type');
    if (type === 'started')
        return { type, key: string(frame['key'], 'authorization key') };
    if (type === 'notice') {
        return {
            type,
            message: string(frame['message'], 'authorization notice'),
            ...(frame['url'] === undefined ? {} : { url: string(frame['url'], 'authorization url') }),
            ...(frame['code'] === undefined ? {} : { code: string(frame['code'], 'authorization code') }),
        };
    }
    if (type === 'prompt-withdrawn') {
        return { type, promptId: string(frame['promptId'], 'authorization prompt id') };
    }
    if (type === 'settled') {
        const status = frame['status'];
        if (status !== 'authorized' && status !== 'cancelled')
            throw new TypeError('authorization status is invalid');
        return { type, status };
    }
    if (type === 'failed')
        return { type, message: string(frame['message'], 'authorization failure') };
    if (type === 'prompt') {
        const prompt = object(frame['prompt'], 'authorization prompt');
        const kind = prompt['kind'];
        if (kind !== 'text' && kind !== 'secret' && kind !== 'select') {
            throw new TypeError('authorization prompt kind is invalid');
        }
        const options = prompt['options'];
        if (options !== undefined && !Array.isArray(options))
            throw new TypeError('prompt options must be an array');
        return {
            type,
            prompt: {
                promptId: string(prompt['promptId'], 'authorization prompt id'),
                kind,
                message: string(prompt['message'], 'authorization prompt message'),
                ...(prompt['placeholder'] === undefined
                    ? {}
                    : { placeholder: string(prompt['placeholder'], 'authorization prompt placeholder') }),
                ...(options === undefined
                    ? {}
                    : {
                        options: options.map((option) => {
                            const item = object(option, 'authorization prompt option');
                            return {
                                id: string(item['id'], 'option id'),
                                label: string(item['label'], 'option label'),
                                ...(item['description'] === undefined
                                    ? {}
                                    : { description: string(item['description'], 'option description') }),
                            };
                        }),
                    }),
            },
        };
    }
    throw new TypeError(`unknown authorization frame ${JSON.stringify(type)}`);
}
const STRING = strict('string', value => string(value));
const OPTIONAL_STRING = strict('string | undefined', (value) => {
    if (value === undefined)
        return undefined;
    return string(value);
});
const BOOLEAN = strict('boolean', value => boolean(value));
const ENTRIES = strict('readonly PiAiAuthorizationEntry[]', authorizationEntries);
const FRAME = strict('PiAiAuthorizationFrame', authorizationFrame);
const parameter = (name, codec, acceptsUndefined = false) => ({
    name,
    wire: name,
    source: 'json',
    codec,
    ...(acceptsUndefined ? { acceptsUndefined: true } : {}),
});
/** Strict Client contract paired with Host source-mode discovery in this bundle. */
export const PI_AI_AUTH_REMOTE = {
    package: '@dingyiliao/dsh-pi-ai-auth',
    descriptors: [
        {
            id: '@dingyiliao/dsh-pi-ai-auth:piAiAuthorization/list',
            service: 'piAiAuthorization', namespace: 'piAiAuthorization', method: 'list',
            invocation: { kind: 'direct' }, parameters: [], result: ENTRIES,
        },
        {
            id: '@dingyiliao/dsh-pi-ai-auth:piAiAuthorization/begin',
            service: 'piAiAuthorization', namespace: 'piAiAuthorization', method: 'begin', mode: 'stream',
            invocation: { kind: 'direct' },
            parameters: [parameter('rawKey', STRING), parameter('method', OPTIONAL_STRING, true)],
            cancellation: { parameter: 'signal' }, result: FRAME,
        },
        ...['answer', 'decline'].map(method => ({
            id: `@dingyiliao/dsh-pi-ai-auth:piAiAuthorization/${method}`,
            service: 'piAiAuthorization', namespace: 'piAiAuthorization', method,
            invocation: { kind: 'direct' },
            parameters: method === 'answer'
                ? [parameter('rawKey', STRING), parameter('promptId', STRING), parameter('value', STRING)]
                : [parameter('rawKey', STRING), parameter('promptId', STRING)],
            result: BOOLEAN,
        })),
        ...['cancel', 'signOut'].map(method => ({
            id: `@dingyiliao/dsh-pi-ai-auth:piAiAuthorization/${method}`,
            service: 'piAiAuthorization', namespace: 'piAiAuthorization', method,
            invocation: { kind: 'direct' },
            parameters: [parameter('rawKey', STRING)], result: BOOLEAN,
        })),
    ],
};
//# sourceMappingURL=remote.js.map