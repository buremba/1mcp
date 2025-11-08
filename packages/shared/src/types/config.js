/**
 * Configuration types - relay.config.json (spec §5.1)
 */
/**
 * Default policy (spec §5.1)
 */
export const DEFAULT_POLICY = {
    network: {
        allowedDomains: ["api.github.com", "*.npmjs.org"],
        deniedDomains: [],
        denyIpLiterals: true,
        blockPrivateRanges: true,
        maxBodyBytes: 5 * 1024 * 1024, // 5MB
        maxRedirects: 5,
    },
    filesystem: {
        readonly: ["/"],
        writable: ["/tmp", "/out"],
    },
    limits: {
        timeoutMs: 60000, // 60s
        memMb: 256,
        stdoutBytes: 1024 * 1024, // 1MB
    },
};
