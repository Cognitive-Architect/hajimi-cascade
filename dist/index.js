"use strict";
/**
 * HAJIMI-MATH-001-CASCADE Fix
 *
 * 修复 RISK-H-001 (uint64 精度) + RISK-H-002 (Fail-fast 兼容) + RISK-H-003 (LSH 索引)
 *
 * @module hajimi-cascade-fix
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// SimHash Chunker - BigInt 全程化
__exportStar(require("./cdc/simhash-chunker.js"), exports);
// SimHash LSH Index - 解决查邻居爆炸问题 (RISK-H-003)
__exportStar(require("./cdc/simhash-lsh-index.js"), exports);
// HCTX Reader - Fail-fast 兼容策略
__exportStar(require("./format/hctx-reader.js"), exports);
//# sourceMappingURL=index.js.map