/**
 * hash-config.ts - B-03: 哈希配置集成 (≤80行)
 */
import { HashStrategy } from '../crypto/hash-factory';
export interface HashConfig {
    strategy: HashStrategy;
    enableBlake3: boolean;
    backwardCompat: boolean;
}
export declare const DEFAULT_HASH_CONFIG: HashConfig;
/** 从环境变量加载配置 */
export declare function loadHashConfig(): HashConfig;
/** 应用配置，返回策略实例 */
export declare function applyHashConfig(config?: Partial<HashConfig>): {
    config: {
        strategy: HashStrategy;
        enableBlake3: boolean;
        backwardCompat: boolean;
    };
    strategy: import("../crypto/hash-factory").HashFactory;
};
/** 配置验证 */
export declare function validateConfig(cfg: HashConfig): boolean;
declare const _default: {
    loadHashConfig: typeof loadHashConfig;
    applyHashConfig: typeof applyHashConfig;
    DEFAULT_HASH_CONFIG: HashConfig;
};
export default _default;
//# sourceMappingURL=hash-config.d.ts.map